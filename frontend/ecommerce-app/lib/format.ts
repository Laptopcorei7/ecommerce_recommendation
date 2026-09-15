/**
 * Display rules for the awkward parts of this dataset.
 *
 * Three facts drive everything here, measured over all 62,222 records:
 *
 *   45.2% of products have no price. That is not a rare edge case to guard
 *   with a fallback, it is nearly half the catalogue, so "no price" is a
 *   first-class state with its own typography rather than an empty string.
 *
 *   Titles run to 111 characters at the median and 300 at the maximum. They
 *   are keyword-stuffed Amazon listings, not product names. Nothing centres
 *   them and nothing assumes they are short.
 *
 *   Rating counts span 0 to hundreds of thousands, so they are always grouped
 *   and always tabular, otherwise a column of them will not line up.
 */

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const count = new Intl.NumberFormat('en-US')

/** A price, or null when the record has none. Callers render the null case. */
export function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined || Number.isNaN(price)) return null
  return money.format(price)
}

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0'
  return count.format(n)
}

/** Model scores are z-score blends, not probabilities. Show them as measured. */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—'
  return score.toFixed(3)
}

export function formatRating(r: number | null | undefined): string {
  if (r === null || r === undefined) return '—'
  return r.toFixed(1)
}

/**
 * The brand, cleaned up.
 *
 * The `store` field is mostly a brand ("Anker", "Sony") but books that leaked
 * into this category carry an author credit instead ("E L James (Author)").
 * The suffix is noise on a product page.
 */
export function formatBrand(store: string | null | undefined): string | null {
  if (!store) return null
  const cleaned = store.replace(/\s*\((Author|Actor|Director|Publisher)\)\s*$/i, '').trim()
  return cleaned || null
}

/*
 * There was a browseCategory() and a slugify() here, reimplementing the
 * bucketing rules from ml_api/catalog.py so links could be built in the
 * browser. Both are gone. The server now sends category_slug and
 * category_name on every product, because the client could not know which
 * raw categories had been folded into which bucket and so produced links to
 * category pages that did not exist.
 */

/**
 * The leading part of a stuffed title, for places too narrow for the whole
 * thing. Cuts on a word boundary rather than mid-word.
 */
export function shortTitle(title: string, max = 60): string {
  if (title.length <= max) return title
  const cut = title.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** User ids are 28-character Amazon hashes. Shown head and tail. */
export function shortUserId(id: string, head = 6, tail = 4): string {
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}
