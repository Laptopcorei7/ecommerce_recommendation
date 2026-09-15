import Link from 'next/link'
import type { Category, ProductPage, Sort } from '@/lib/catalog-types'
import { formatCount } from '@/lib/format'
import { Pagination } from '@/components/pagination'
import { ProductCard, ProductRow } from '@/components/product-list'
import { SortSelect } from '@/components/sort-select'

/**
 * The browse surface, shared by /catalog and /categories/[slug].
 *
 * Category sits in a left rail rather than a dropdown. This catalogue has 21
 * buckets and they are wildly uneven, from 26,466 products down to 218, and a
 * rail shows that shape while a dropdown hides it. Seeing that one category is
 * 43% of the catalogue is genuinely useful before you start filtering.
 *
 * Rows are the default view because the titles are 111 characters at the
 * median. Grid is offered for when the photograph is what you are scanning
 * for, and the choice lives in the URL so it survives a reload and a link.
 */
export function CatalogBrowser({
  categories,
  page,
  activeCategory,
  q,
  sort,
  view,
  basePath,
  params,
}: {
  categories: Category[]
  page: ProductPage
  activeCategory: string | null
  q: string
  sort: Sort
  view: 'rows' | 'grid'
  basePath: string
  params: Record<string, string>
}) {
  const viewHref = (v: 'rows' | 'grid') => {
    const qs = new URLSearchParams(params)
    if (v === 'grid') qs.set('view', 'grid')
    else qs.delete('view')
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  return (
    <div className="grid gap-8 py-8 lg:grid-cols-[210px_minmax(0,1fr)]">
      {/* ---- category rail ---- */}
      <aside className="lg:sticky lg:top-[150px] lg:self-start">
        <h2 className="label mb-2 border-b border-rule-heavy pb-1.5 text-ink">
          Categories
        </h2>
        <ul>
          <li>
            <Link
              href="/catalog"
              className={`flex items-baseline justify-between gap-2 border-b border-rule py-1.5 text-[12.5px] ${
                activeCategory === null ? 'font-medium text-signal' : 'hover:text-signal'
              }`}
            >
              <span>All products</span>
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/categories/${c.slug}`}
                className={`flex items-baseline justify-between gap-2 border-b border-rule py-1.5 text-[12.5px] ${
                  activeCategory === c.slug
                    ? 'font-medium text-signal'
                    : 'hover:text-signal'
                }`}
              >
                <span className="min-w-0">{c.name}</span>
                <span className="font-mono tnum shrink-0 text-[11px] text-ink-3">
                  {formatCount(c.count)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {/* ---- results ---- */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-3">
          <p className="text-[13px]">
            <span className="font-mono tnum font-medium">
              {formatCount(page.total)}
            </span>{' '}
            <span className="text-ink-2">
              {page.total === 1 ? 'product' : 'products'}
            </span>
            {q && <span className="text-ink-2"> matching “{q}”</span>}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <SortSelect value={sort} basePath={basePath} params={params} />
            <span className="flex items-center gap-2">
              <span className="label">View</span>
              <span className="flex">
                <Link
                  href={viewHref('rows')}
                  className={`btn ${view === 'rows' ? '' : 'btn-line'}`}
                >
                  Rows
                </Link>
                <Link
                  href={viewHref('grid')}
                  className={`btn ${view === 'grid' ? '' : 'btn-line'} border-l-0`}
                >
                  Grid
                </Link>
              </span>
            </span>
          </div>
        </div>

        {page.items.length === 0 ? (
          <div className="border border-rule bg-paper-sunk px-4 py-10 text-center">
            <p className="text-[14px]">Nothing here matches those filters.</p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[13px] text-ink-2">
              Search matches whole words against the product title and brand
              only, so a model number that is not written in the title will not
              be found.
            </p>
            <Link href="/catalog" className="btn btn-line mt-4">
              Clear filters
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {page.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="border-t border-rule">
            {page.items.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </div>
        )}

        <Pagination
          page={page.page}
          pages={page.pages}
          basePath={basePath}
          params={params}
        />
      </div>
    </div>
  )
}
