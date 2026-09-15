import type { Metadata } from 'next'
import { getCategories, getProducts } from '@/lib/api'
import { readCatalogParams, type CatalogSearch } from '@/lib/params'
import { CatalogBrowser } from '@/components/catalog-browser'

/**
 * Browse and search the whole catalogue.
 *
 * Every filter lives in the URL and the page renders on the server, so a
 * result is linkable and the first paint is the content itself rather than a
 * spinner waiting on a client fetch.
 */

export const metadata: Metadata = { title: 'Catalogue' }

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearch>
}) {
  const { q, sort, page, view, params } = readCatalogParams(await searchParams)

  const [categories, results] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ q: q || undefined, sort, page, perPage: 24 }).catch(() => ({
      total: 0,
      page: 1,
      pages: 0,
      per_page: 24,
      items: [],
    })),
  ])

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="border-b-2 border-rule-heavy pb-4 pt-8">
        <p className="label mb-2">Catalogue</p>
        <h1 className="text-[26px] font-semibold leading-tight">
          {q ? `Search: ${q}` : 'All products'}
        </h1>
      </div>

      <CatalogBrowser
        categories={categories}
        page={results}
        activeCategory={null}
        q={q}
        sort={sort}
        view={view}
        basePath="/catalog"
        params={params}
      />
    </div>
  )
}
