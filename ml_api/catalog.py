"""Browse, filter and search over the product catalogue.

The model service could only answer "what should this user see next". A
storefront also has to answer "show me everything in this category", "find me
the ones matching these words" and "what is this one item", and none of those
are recommender questions. They are catalogue questions, so they live here
rather than being bolted onto the recommender.

Everything is held in memory. The catalogue is 62,222 records and about 27MB of
JSON, which is small enough that an index built once at startup beats any
lookup that has to touch disk per request.

Two things about this data shape the code:

  Category. Records carry a `categories` path whose first element is always
  "Electronics", so the useful browse bucket is the second element. Taken
  literally that yields 145 buckets, 125 of which are merchandising nodes
  holding 936 items between them, so the tail is folded. See MIN_BUCKET.

  Price. Only 54.8% of records have one. Sorting by price therefore has to
  decide where the other 45.2% go, and the answer is always last, in both
  directions. A null price is missing, not free, and not expensive.
"""

from __future__ import annotations

import re
import unicodedata

# Every categories path in this dataset starts with this, so it carries no
# information and is skipped when picking the browse bucket.
ROOT_CATEGORY = "Electronics"

# Buckets smaller than this are folded into the record's main_category.
#
# The raw category paths yield 145 buckets, and 125 of them hold fewer than 200
# products between them, 936 items in total. They are not categories: the tail
# is Amazon merchandising nodes that leaked into the path, with names like
# "Buy Samsung at as low as 0% APR", "Electronics $5 Store" and "Optoma
# Projectors", most of them holding a single item.
#
# Folding rather than dropping, so every product stays reachable from exactly
# one category page. The 20 buckets above the threshold already cover 98.5% of
# the catalogue.
MIN_BUCKET = 200
FALLBACK_BUCKET = "Other"

SORTS = ("popular", "rating", "price-asc", "price-desc", "title")
DEFAULT_SORT = "popular"


def slugify(text):
    """A url-safe slug. Stable, because slugs are the category route keys."""
    text = unicodedata.normalize("NFKD", str(text))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "other"


def bucket_of(record):
    """The category this record browses under.

    The second element of the path, since the first is always "Electronics".
    Records without one fall back to main_category, then to a literal Other, so
    every record is reachable from exactly one category page.
    """
    path = record.get("categories") or []
    for name in path:
        if name and name != ROOT_CATEGORY:
            return name
    return record.get("main_category") or "Other"


class Catalog:
    """An indexed, read-only view of the product records."""

    def __init__(self, records, min_bucket=MIN_BUCKET):
        # A list fixes an order once, so page 2 of a query means the same thing
        # on two different requests. Dict order would do it too, but only by
        # accident of the insertion order.
        self.by_id = records
        self._items = list(records.values())
        self.min_bucket = min_bucket

        # Lowercased title + brand, built once. Search scans this rather than
        # re-lowercasing 62k titles on every keystroke.
        self._haystack = [
            "{} {}".format(r.get("title") or "", r.get("store") or "").lower()
            for r in self._items
        ]

        # Sort keys, precomputed for the same reason.
        self._popularity = [r.get("rating_number") or 0 for r in self._items]
        self._rating = [r.get("average_rating") or 0.0 for r in self._items]
        self._price = [r.get("price") for r in self._items]
        self._title = [(r.get("title") or "").lower() for r in self._items]

        self._buckets = {}      # slug -> list of positions
        self._names = {}        # slug -> display name
        self._bucket_of_id = {}  # item id -> slug
        for pos, name in enumerate(self._assign_buckets()):
            slug = slugify(name)
            self._buckets.setdefault(slug, []).append(pos)
            self._names.setdefault(slug, name)
            self._bucket_of_id[self._items[pos]["id"]] = slug

    def _assign_buckets(self):
        """The category each record browses under, after folding the tail.

        Two passes, because whether a bucket is too small to keep can only be
        known once every record has been counted. A record in a rejected bucket
        moves to its main_category, and to Other when that is also too small or
        absent.
        """
        primary = [bucket_of(r) for r in self._items]
        sizes = {}
        for name in primary:
            sizes[name] = sizes.get(name, 0) + 1

        assigned = []
        for record, name in zip(self._items, primary):
            if sizes.get(name, 0) >= self.min_bucket:
                assigned.append(name)
                continue
            fallback = record.get("main_category")
            if fallback and sizes.get(fallback, 0) >= self.min_bucket:
                assigned.append(fallback)
            else:
                assigned.append(FALLBACK_BUCKET)
        return assigned

    def __len__(self):
        return len(self._items)

    # ------------------------------------------------------------ categories

    def categories(self):
        """Every browse bucket with its size, largest first."""
        return [
            {"slug": slug, "name": self._names[slug], "count": len(positions)}
            for slug, positions in sorted(
                self._buckets.items(), key=lambda kv: -len(kv[1])
            )
        ]

    def bucket(self, item_id):
        """The bucket one product browses under, or None if it is not here.

        Every product carries this on the wire so the storefront never has to
        re-derive it. Deriving it in the browser looked reasonable and was
        wrong twice over: the client would have to reimplement slugify, and it
        cannot know about the folding, so a product whose raw category was
        folded away would link to a category page that 404s.
        """
        slug = self._bucket_of_id.get(item_id)
        return None if slug is None else {"slug": slug, "name": self._names[slug]}

    def category(self, slug):
        """One bucket, or None. Callers turn None into a 404."""
        if slug not in self._buckets:
            return None
        return {
            "slug": slug,
            "name": self._names[slug],
            "count": len(self._buckets[slug]),
        }

    # ---------------------------------------------------------------- browse

    def _sort_key(self, sort):
        """A (key, reverse) pair for sorting positions.

        Missing values sort last in every direction, so a null price never
        wins "cheapest" and a null rating never wins "best rated". Each key
        returns a tuple whose first element is a present/absent flag, which
        is negated for the descending sorts so the flag survives the reverse.
        """
        if sort == "rating":
            return (lambda p: (self._rating[p], self._popularity[p]), True)
        if sort == "price-asc":
            return (
                lambda p: (self._price[p] is None, self._price[p] or 0.0),
                False,
            )
        if sort == "price-desc":
            # The flag is inverted so that reversing sends nulls to the back
            # rather than the front.
            return (
                lambda p: (self._price[p] is not None, self._price[p] or 0.0),
                True,
            )
        if sort == "title":
            return (lambda p: self._title[p], False)
        return (lambda p: self._popularity[p], True)   # popular

    def search(self, q=None, category=None, sort=DEFAULT_SORT, page=1, per_page=24):
        """Filter, sort and paginate. Returns the page plus the full total."""
        if sort not in SORTS:
            sort = DEFAULT_SORT

        if category:
            positions = self._buckets.get(category)
            if positions is None:
                return {"total": 0, "page": 1, "pages": 0,
                        "per_page": per_page, "items": []}
            positions = list(positions)
        else:
            positions = range(len(self._items))

        terms = [t for t in (q or "").lower().split() if t]
        if terms:
            hay = self._haystack
            positions = [
                p for p in positions if all(t in hay[p] for t in terms)
            ]
        elif not category:
            positions = list(positions)

        key, reverse = self._sort_key(sort)
        positions.sort(key=key, reverse=reverse)

        total = len(positions)
        pages = (total + per_page - 1) // per_page
        page = max(1, min(page, pages)) if pages else 1
        start = (page - 1) * per_page
        window = positions[start:start + per_page]

        return {
            "total": total,
            "page": page,
            "pages": pages,
            "per_page": per_page,
            "items": [self._items[p] for p in window],
        }
