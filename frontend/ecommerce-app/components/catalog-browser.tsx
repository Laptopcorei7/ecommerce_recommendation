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
    <div className="grid gap-8 pb-8 lg:grid-cols-[230px_minmax(0,1fr)]">
      {/* ---- category rail ---- */}
      <aside className="lg:sticky lg:top-[132px] lg:self-start">
        <h2 className="display mb-3 text-[15px]">Categories</h2>
        {/* A horizontal strip of pills on narrow screens, a list on wide ones. */}
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
          <li className="shrink-0">
            <RailLink href="/catalog" active={activeCategory === null} name="All products" />
          </li>
          {categories.map((c) => (
            <li key={c.slug} className="shrink-0">
              <RailLink
                href={`/categories/${c.slug}`}
                active={activeCategory === c.slug}
                name={c.name}
                count={c.count}
              />
            </li>
          ))}
        </ul>
      </aside>

      {/* ---- results ---- */}
      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-[15px]">
            <span className="tnum font-bold">{formatCount(page.total)}</span>{' '}
            <span className="text-fg-2">{page.total === 1 ? 'product' : 'products'}</span>
            {q && <span className="text-fg-2"> matching “{q}”</span>}
          </p>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <SortSelect value={sort} basePath={basePath} params={params} />
            <span className="flex rounded-full bg-tile p-1" role="group" aria-label="View">
              {(['rows', 'grid'] as const).map((v) => (
                <Link
                  key={v}
                  href={viewHref(v)}
                  aria-current={view === v ? 'true' : undefined}
                  className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold uppercase ${
                    view === v ? 'bg-fg text-bg' : 'hover:bg-tile-2'
                  }`}
                >
                  {v === 'rows' ? 'Rows' : 'Grid'}
                </Link>
              ))}
            </span>
          </div>
        </div>

        {page.items.length === 0 ? (
          <div className="bg-tile px-5 py-12 text-center">
            <p className="display text-[22px]">Nothing matches those filters.</p>
            <p className="mx-auto mt-3 max-w-[46ch] text-[14px] text-fg-2">
              Search matches whole words against the product title and brand
              only, so a model number that is not written in the title will not
              be found.
            </p>
            <Link href="/catalog" className="btn mt-6">
              Clear filters
            </Link>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3">
            {page.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
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

function RailLink({
  href,
  active,
  name,
  count,
}: {
  href: string
  active: boolean
  name: string
  count?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-baseline justify-between gap-3 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13.5px] lg:whitespace-normal ${
        active ? 'bg-fg font-semibold text-bg' : 'bg-tile hover:bg-tile-2 lg:bg-transparent'
      }`}
    >
      <span className="min-w-0">{name}</span>
      {count !== undefined && (
        <span className={`tnum shrink-0 text-[12px] ${active ? 'text-bg/70' : 'text-fg-3'}`}>
          {formatCount(count)}
        </span>
      )}
    </Link>
  )
}
