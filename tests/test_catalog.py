"""The browse layer: bucketing, sorting, search and pagination.

These are catalogue questions rather than recommender ones, and the storefront
depends on all of them, so they get the same treatment as the model code. Each
test names the property it protects rather than the function it calls.
"""

from __future__ import annotations

import pytest

from ml_api.catalog import Catalog, bucket_of, slugify


def record(id, title="Thing", price=None, rating=4.0, count=10,
           categories=None, main=None, store="Brand"):
    return {
        "id": id,
        "title": title,
        "price": price,
        "image": None,
        "store": store,
        "main_category": main,
        "categories": categories if categories is not None else ["Electronics", "Audio"],
        "average_rating": rating,
        "rating_number": count,
    }


def catalog(records, min_bucket=1):
    return Catalog({r["id"]: r for r in records}, min_bucket=min_bucket)


# --- slugs ------------------------------------------------------------------

@pytest.mark.parametrize("name,slug", [
    ("Computers & Accessories", "computers-accessories"),
    ("GPS, Finders & Accessories", "gps-finders-accessories"),
    ("Headphones, Earbuds & Accessories", "headphones-earbuds-accessories"),
    ("eBook Readers & Accessories", "ebook-readers-accessories"),
    ("Café Electronics", "cafe-electronics"),
    ("!!!", "other"),
])
def test_slugs_are_url_safe_and_stable(name, slug):
    """Slugs are route keys, so a change here breaks saved links."""
    assert slugify(name) == slug


def test_a_product_reports_the_bucket_it_was_folded_into():
    """The storefront must not re-derive this. It cannot know about folding, so
    deriving a slug in the browser produced links to category pages that 404."""
    records = [
        record("A", categories=["Electronics", "Home Audio"]),
        record("B", categories=["Electronics", "Home Audio"]),
        record("PROMO", categories=["Electronics", "Electronics $5 Store"],
               main="Home Audio"),
    ]
    cat = catalog(records, min_bucket=2)
    assert cat.bucket("PROMO") == {"slug": "home-audio", "name": "Home Audio"}
    assert cat.bucket("A")["slug"] == "home-audio"


def test_the_bucket_of_an_unknown_product_is_none():
    assert catalog([record("A")]).bucket("GHOST") is None


# --- bucketing --------------------------------------------------------------

def test_the_electronics_root_is_never_the_bucket():
    """Every path in this dataset starts with Electronics, so using the first
    element would put all 62,222 products in one category."""
    assert bucket_of(record("A", categories=["Electronics", "Home Audio"])) == "Home Audio"


def test_a_record_with_only_the_root_falls_back_to_main_category():
    assert bucket_of(record("A", categories=["Electronics"], main="Computers")) == "Computers"


def test_a_record_with_no_usable_category_still_gets_one():
    """Nothing may be unreachable, so there is always a bucket."""
    assert bucket_of(record("A", categories=[], main=None)) == "Other"


def test_small_buckets_fold_into_main_category():
    """The raw paths carry 125 merchandising nodes such as 'Electronics $5
    Store', most holding one item. They are folded rather than shown."""
    records = [
        record("A{}".format(i), categories=["Electronics", "Home Audio"], main="Audio")
        for i in range(5)
    ]
    records.append(
        record("PROMO", categories=["Electronics", "Buy Samsung at 0% APR"], main="Home Audio")
    )
    cat = catalog(records, min_bucket=3)
    slugs = {c["slug"] for c in cat.categories()}
    assert "buy-samsung-at-0-apr" not in slugs
    assert cat.category("home-audio")["count"] == 6


def test_folding_never_loses_a_product():
    """Folding must be a reassignment, not a filter."""
    records = [
        record("A", categories=["Electronics", "Big"]),
        record("B", categories=["Electronics", "Big"]),
        record("C", categories=["Electronics", "Tiny"], main=None),
    ]
    cat = catalog(records, min_bucket=2)
    assert sum(c["count"] for c in cat.categories()) == len(cat) == 3


def test_a_product_lands_in_exactly_one_bucket():
    records = [record("A{}".format(i), categories=["Electronics", "Audio"]) for i in range(4)]
    cat = catalog(records)
    total = sum(c["count"] for c in cat.categories())
    assert total == len(records)


def test_categories_are_ordered_largest_first():
    records = [record("A{}".format(i), categories=["Electronics", "Big"]) for i in range(5)]
    records += [record("B{}".format(i), categories=["Electronics", "Small"]) for i in range(2)]
    counts = [c["count"] for c in catalog(records).categories()]
    assert counts == sorted(counts, reverse=True)


def test_an_unknown_slug_is_reported_rather_than_guessed():
    assert catalog([record("A")]).category("no-such-thing") is None


# --- sorting ----------------------------------------------------------------

def test_missing_prices_sort_last_ascending():
    """45.2% of this catalogue has no price. A null must never win 'cheapest'."""
    records = [
        record("NULL", price=None),
        record("CHEAP", price=5.0),
        record("DEAR", price=500.0),
    ]
    ids = [i["id"] for i in catalog(records).search(sort="price-asc")["items"]]
    assert ids == ["CHEAP", "DEAR", "NULL"]


def test_missing_prices_sort_last_descending_too():
    """The reverse direction is where a naive sort key sends nulls to the top."""
    records = [
        record("NULL", price=None),
        record("CHEAP", price=5.0),
        record("DEAR", price=500.0),
    ]
    ids = [i["id"] for i in catalog(records).search(sort="price-desc")["items"]]
    assert ids == ["DEAR", "CHEAP", "NULL"]


def test_popularity_sorts_by_rating_count():
    records = [record("LOW", count=3), record("HIGH", count=9000)]
    ids = [i["id"] for i in catalog(records).search(sort="popular")["items"]]
    assert ids == ["HIGH", "LOW"]


def test_rating_ties_break_on_the_rating_count():
    """Ratings cluster hard around 4.5, so ties are the common case and an
    unbroken tie makes the ordering arbitrary."""
    records = [record("FEW", rating=4.5, count=2), record("MANY", rating=4.5, count=8000)]
    ids = [i["id"] for i in catalog(records).search(sort="rating")["items"]]
    assert ids == ["MANY", "FEW"]


def test_an_unknown_sort_falls_back_rather_than_failing():
    assert catalog([record("A")]).search(sort="by-vibes")["total"] == 1


# --- search -----------------------------------------------------------------

def test_search_matches_the_title():
    records = [record("A", title="Sony Wireless Headphones"), record("B", title="HDMI Cable")]
    assert [i["id"] for i in catalog(records).search(q="wireless")["items"]] == ["A"]


def test_search_matches_the_brand():
    records = [record("A", title="Widget", store="Anker"), record("B", title="Widget", store="Sony")]
    assert [i["id"] for i in catalog(records).search(q="anker")["items"]] == ["A"]


def test_all_terms_must_match():
    """Otherwise 'sony wireless' returns every Sony product ever made."""
    records = [
        record("BOTH", title="Sony Wireless Earbuds"),
        record("ONE", title="Sony HDMI Cable"),
    ]
    assert [i["id"] for i in catalog(records).search(q="sony wireless")["items"]] == ["BOTH"]


def test_search_is_case_insensitive():
    records = [record("A", title="Sony Wireless")]
    assert catalog(records).search(q="SONY")["total"] == 1


def test_search_and_category_apply_together():
    records = [
        record("A", title="Sony Speaker", categories=["Electronics", "Home Audio"]),
        record("B", title="Sony Camera", categories=["Electronics", "Camera"]),
    ]
    hits = catalog(records).search(q="sony", category="home-audio")["items"]
    assert [i["id"] for i in hits] == ["A"]


def test_a_category_that_does_not_exist_yields_nothing_not_everything():
    """Falling through to an unfiltered listing would silently show 62,222
    products for a bad slug."""
    assert catalog([record("A")]).search(category="ghost")["total"] == 0


# --- pagination -------------------------------------------------------------

def test_total_counts_all_matches_not_just_the_page():
    records = [record("A{:02d}".format(i), count=i) for i in range(30)]
    page = catalog(records).search(per_page=10)
    assert page["total"] == 30 and len(page["items"]) == 10 and page["pages"] == 3


def test_pages_do_not_overlap_and_cover_everything():
    records = [record("A{:02d}".format(i), count=i) for i in range(25)]
    cat = catalog(records)
    seen = []
    for p in range(1, 4):
        seen += [i["id"] for i in cat.search(page=p, per_page=10)["items"]]
    assert len(seen) == 25 and len(set(seen)) == 25


def test_a_page_past_the_end_clamps_rather_than_returning_empty():
    records = [record("A{:02d}".format(i)) for i in range(5)]
    page = catalog(records).search(page=99, per_page=10)
    assert page["page"] == 1 and len(page["items"]) == 5


def test_an_empty_result_reports_zero_pages_without_dividing_by_zero():
    page = catalog([record("A", title="thing")]).search(q="nothingmatchesthis")
    assert page["total"] == 0 and page["pages"] == 0 and page["items"] == []


def test_an_empty_catalogue_is_not_a_crash():
    """The API builds this before the model file is known to be good."""
    empty = Catalog({})
    assert len(empty) == 0
    assert empty.categories() == []
    assert empty.search()["total"] == 0
