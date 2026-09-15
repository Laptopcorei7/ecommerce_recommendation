import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategories, getProducts } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { readCatalogParams, type CatalogSearch } from '@/lib/params'
import { CatalogBrowser } from '@/components/catalog-browser'

/**
 * One category.
 *
 * This single file closes seven of the previous build's dead links. Those
 * links pointed at invented slugs (/categories/smartphones, /categories/tvs)
 * that matched nothing in the data; these are the real buckets the API
 * derives from the category path on every record, so a slug either names a
 * bucket that exists or the page is a 404.
 */

export async function generateStaticParams() {
  // Pre-rendered at build time. There are only 22 of them and they change
  // solely on a retrain.
  const categories = await getCategories().catch(() => [])
  return categories.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const categories = await getCategories().catch(() => [])
  const category = categories.find((c) => c.slug === slug)
  if (!category) return { title: 'Category not found' }
  return {
    title: category.name,
    description: `${formatCount(category.count)} products in ${category.name}.`,
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<CatalogSearch>
}) {
  const { slug } = await params
  const { q, sort, page, view, params: query } = readCatalogParams(await searchParams)

  const categories = await getCategories().catch(() => [])
  const category = categories.find((c) => c.slug === slug)
  if (!category) notFound()

  const results = await getProducts({
    category: slug,
    q: q || undefined,
    sort,
    page,
    perPage: 24,
  }).catch(() => ({ total: 0, page: 1, pages: 0, per_page: 24, items: [] }))

  const share = category.count / categories.reduce((n, c) => n + c.count, 0)

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="border-b-2 border-rule-heavy pb-4 pt-8">
        <nav className="label mb-2 flex gap-2" aria-label="Breadcrumb">
          <Link href="/catalog" className="hover:text-signal">
            Catalogue
          </Link>
          <span aria-hidden>/</span>
          <span className="text-ink">{category.name}</span>
        </nav>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-[26px] font-semibold leading-tight">
            {category.name}
          </h1>
          <p className="label">
            <span className="tnum text-ink">{formatCount(category.count)}</span>{' '}
            products, <span className="tnum text-ink">{(share * 100).toFixed(1)}%</span>{' '}
            of the catalogue
          </p>
        </div>
      </div>

      <CatalogBrowser
        categories={categories}
        page={results}
        activeCategory={slug}
        q={q}
        sort={sort}
        view={view}
        basePath={`/categories/${slug}`}
        params={query}
      />
    </div>
  )
}
