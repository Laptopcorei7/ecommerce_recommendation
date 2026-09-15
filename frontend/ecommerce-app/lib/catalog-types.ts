/**
 * The shapes the model service returns, and nothing else.
 *
 * These are separate from lib/api.ts because that module is marked
 * `server-only`: it holds the service address and must never reach the bundle.
 * Client components still need to describe the data they are handed, so the
 * types and the sort options live here, where both sides can import them.
 *
 * Types are erased at compile time and SORTS is five static strings, so
 * nothing here leaks anything.
 */

export type Product = {
  id: string
  title: string
  price: number | null
  image: string | null
  store: string | null
  categories: string[]
  average_rating: number | null
  rating_number: number | null
  /**
   * The category page this product actually lives on. Sent by the API rather
   * than derived here: the browser cannot know which raw categories were
   * folded into which bucket, so deriving a slug locally produces links to
   * category pages that do not exist.
   */
  category_slug: string | null
  category_name: string | null
  /** Present on the recommendation path only. */
  score?: number | null
  /** The two weighted halves of the blend. They sum to score. */
  collaborative?: number | null
  content?: number | null
  /** Present on a shopper's history only: the rating that shopper gave it. */
  user_rating?: number | null
}

/** A shopper from the training data, described by what they actually rated. */
export type Shopper = {
  id: string
  rated: number
  top_category: string | null
}

export type Category = {
  slug: string
  name: string
  count: number
}

export type ProductPage = {
  total: number
  page: number
  pages: number
  per_page: number
  items: Product[]
}

export type ProductDetail = {
  product: Product
  similar: Product[]
}

export type Recommendations = {
  user_id: string
  count: number
  alpha: number
  items: Product[]
  /** How many items this shopper rated in training. */
  rated: number
  /** Their highest-rated items, which the picks are excluded from. */
  history: Product[]
}

export type Sort = 'popular' | 'rating' | 'price-asc' | 'price-desc' | 'title'

export const SORTS: { value: Sort; label: string }[] = [
  { value: 'popular', label: 'Most rated' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price, low first' },
  { value: 'price-desc', label: 'Price, high first' },
  { value: 'title', label: 'Name' },
]
