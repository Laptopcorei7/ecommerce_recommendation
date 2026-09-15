import { SORTS, type Sort } from '@/lib/catalog-types'

/**
 * Query string parsing for the browse pages.
 *
 * Search parameters arrive as strings from anywhere, so nothing here is
 * trusted: an unknown sort falls back rather than reaching the API, page is
 * clamped to a positive integer, and the query is length-capped.
 *
 * It also returns the same values as a plain object, which the sort control
 * and the pagination links use to rebuild the URL while preserving whatever
 * else is active. Defaults are omitted from that object so the canonical URL
 * for an unfiltered listing stays clean.
 */

export type CatalogSearch = {
  q?: string
  sort?: string
  page?: string
  view?: string
}

export type CatalogParams = {
  q: string
  sort: Sort
  page: number
  view: 'rows' | 'grid'
  params: Record<string, string>
}

export function readCatalogParams(sp: CatalogSearch): CatalogParams {
  const q = (sp.q ?? '').trim().slice(0, 120)
  const sort = (SORTS.some((s) => s.value === sp.sort) ? sp.sort : 'popular') as Sort
  const parsed = Number.parseInt(sp.page ?? '1', 10)
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  const view: 'rows' | 'grid' = sp.view === 'grid' ? 'grid' : 'rows'

  const params: Record<string, string> = {}
  if (q) params.q = q
  if (sort !== 'popular') params.sort = sort
  if (view === 'grid') params.view = 'grid'

  return { q, sort, page, view, params }
}
