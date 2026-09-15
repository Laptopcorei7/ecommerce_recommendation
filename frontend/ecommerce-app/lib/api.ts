/**
 * The one place that knows the model service exists.
 *
 * Everything here runs on the server. The service address is read from the
 * environment without a NEXT_PUBLIC_ prefix, so it is never bundled into the
 * client. Client components that need live data (the recommendation panel,
 * search-as-you-type) go through the route handlers in app/api, which call
 * back into this module. The browser never learns where the model lives.
 *
 * The previous storefront had no data layer at all: every page carried its own
 * hardcoded array of invented products.
 */

import 'server-only'

const BASE = (process.env.MODEL_API_URL ?? 'http://127.0.0.1:8001').replace(/\/$/, '')

export type {
  Category,
  Product,
  ProductDetail,
  ProductPage,
  Recommendations,
  Shopper,
  Sort,
} from '@/lib/catalog-types'
export { SORTS } from '@/lib/catalog-types'

import type {
  Category,
  Product,
  ProductDetail,
  ProductPage,
  Recommendations,
  Shopper,
  Sort,
} from '@/lib/catalog-types'

/** Thrown with the upstream status attached so callers can map 404 to notFound(). */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type FetchOpts = { revalidate?: number; signal?: AbortSignal }

async function get<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const url = `${BASE}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      // The catalogue is a static build artefact that only changes on a
      // retrain, so it caches well. Recommendations pass revalidate: 0.
      next: { revalidate: opts.revalidate ?? 300 },
      signal: opts.signal,
    })
  } catch (cause) {
    // A dead model service is the single most likely failure in local
    // development, so it gets a message that says what to start.
    throw new ApiError(
      503,
      `Cannot reach the model service at ${BASE}. Start it with: ` +
        `python -m uvicorn ml_api.main:app --port 8001`,
    )
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body?.detail) detail = body.detail
    } catch {
      // A non-JSON error body is not worth a second failure.
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

export function getCategories() {
  return get<Category[]>('/catalog/categories')
}

export function getProducts(params: {
  q?: string
  category?: string
  sort?: Sort
  page?: number
  perPage?: number
  signal?: AbortSignal
}) {
  const qs = new URLSearchParams()
  if (params.q) qs.set('q', params.q)
  if (params.category) qs.set('category', params.category)
  qs.set('sort', params.sort ?? 'popular')
  qs.set('page', String(params.page ?? 1))
  qs.set('per_page', String(params.perPage ?? 24))
  return get<ProductPage>(`/catalog/products?${qs}`, { signal: params.signal })
}

export function getProduct(id: string, similar = 8) {
  return get<ProductDetail>(
    `/catalog/products/${encodeURIComponent(id)}?similar=${similar}`,
  )
}

export function getRecommendations(userId: string, topN = 12, alpha?: number) {
  const qs = new URLSearchParams({ user_id: userId, top_n: String(topN) })
  if (alpha !== undefined) qs.set('alpha', String(alpha))
  // Never cached: the whole point is that it is per-user and alpha is tunable
  // live from the recommendations page.
  return get<Recommendations>(`/recommend/?${qs}`, { revalidate: 0 })
}

export function getSampleUsers(n = 12) {
  return get<{ user_ids: string[]; users: Shopper[] }>(`/users/sample?n=${n}`, {
    revalidate: 3600,
  })
}

export function getHealth() {
  return get<{
    status: string
    users?: number
    items?: number
    factors?: number
    alpha?: number
    alpha_at_training?: number
    catalog?: number
    detail?: string
  }>('/health', { revalidate: 0 })
}
