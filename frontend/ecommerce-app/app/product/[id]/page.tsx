import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApiError, getProduct } from '@/lib/api'
import { formatBrand, formatCount, formatScore, shortTitle } from '@/lib/format'
import { BuyBox } from '@/components/buy-box'
import { ProductCard } from '@/components/product-list'
import { ProductImage, Rating } from '@/components/product-bits'

/**
 * One product.
 *
 * The previous version of this route took an [id] segment and never read it.
 * Every product in the catalogue rendered the same hardcoded pair of Sony
 * headphones, at the same invented price, with the same invented reviews.
 *
 * This reads the id, looks it up, and 404s when there is no such record. The
 * "similar products" below are real neighbours from the item-item content
 * matrix the model's content half uses, so the page and the model agree on
 * what similar means.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  try {
    const { product } = await getProduct(id, 0)
    return {
      title: shortTitle(product.title, 70),
      description: shortTitle(product.title, 155),
    }
  } catch {
    return { title: 'Product not found' }
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let data
  try {
    data = await getProduct(id, 8)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound()
    throw err
  }

  const { product, similar } = data
  const brand = formatBrand(product.store)
  // The full path minus the constant "Electronics" root every record shares.
  const path = (product.categories ?? []).filter((c) => c && c !== 'Electronics')

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      {/* Only the browse bucket is a link. The deeper path levels are real
          text from the source, but they name nothing that has a page: linking
          them produced slugs like /categories/earbud-headphones that 404. */}
      <nav className="label flex flex-wrap gap-2 py-4" aria-label="Breadcrumb">
        <Link href="/catalog" className="hover:text-signal">
          Catalogue
        </Link>
        {product.category_slug && (
          <span className="flex gap-2">
            <span aria-hidden>/</span>
            <Link
              href={`/categories/${product.category_slug}`}
              className="hover:text-signal"
            >
              {product.category_name}
            </Link>
          </span>
        )}
        {/* Whatever the bucket link already said is dropped, by name rather
            than by position: a folded product's bucket comes from its
            main_category and need not appear in this path at all. */}
        {path.filter((c) => c !== product.category_name).map((c) => (
          <span key={c} className="flex gap-2">
            <span aria-hidden>/</span>
            <span>{c}</span>
          </span>
        ))}
      </nav>

      <div className="grid gap-8 border-t-2 border-rule-heavy py-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)_320px]">
        {/* ---- image ---- */}
        <div className="aspect-square">
          <ProductImage
            src={product.image}
            alt={product.title}
            id={product.id}
            sizes="(max-width: 1024px) 100vw, 440px"
            priority
          />
        </div>

        {/* ---- identity ---- */}
        <div className="min-w-0">
          {brand && (
            <p className="label mb-2 text-ink-2">{brand}</p>
          )}
          {/* Titles run to 300 characters. Left aligned, allowed to wrap, and
              set at a size that stays readable at that length. */}
          <h1 className="text-[20px] font-medium leading-snug">{product.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Rating
              value={product.average_rating}
              count={product.rating_number}
              showCount={false}
            />
            <span className="text-[12.5px] text-ink-2">
              <span className="font-mono tnum">
                {formatCount(product.rating_number)}
              </span>{' '}
              ratings
            </span>
          </div>

          {/* A specification table. Every row is a field that exists on the
              record; nothing here is invented copy. */}
          <dl className="mt-6 border-t border-rule">
            {[
              ['Part number', product.id],
              ['Brand', brand ?? 'Not recorded'],
              ['Category', product.category_name ?? 'Not recorded'],
              ['Full path', path.join(' › ') || 'Not recorded'],
              [
                'Average rating',
                product.average_rating === null
                  ? 'Not recorded'
                  : `${product.average_rating.toFixed(1)} of 5`,
              ],
              ['Rating count', formatCount(product.rating_number)],
              [
                'Price',
                product.price === null
                  ? 'Not present in the source data'
                  : `$${product.price.toFixed(2)}`,
              ],
            ].map(([term, value]) => (
              <div
                key={term}
                className="grid grid-cols-[128px_minmax(0,1fr)] gap-4 border-b border-rule py-2"
              >
                <dt className="label pt-[3px]">{term}</dt>
                <dd className="break-words text-[13px]">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-3">
            Fields come from the Amazon Reviews 2023 product metadata exactly as
            published. There is no description here because the source has none
            for this record, and writing one would be inventing it.
          </p>
        </div>

        {/* ---- buy ---- */}
        <div className="lg:sticky lg:top-[150px] lg:self-start">
          <BuyBox product={product} />
        </div>
      </div>

      {/* ---- similar ---- */}
      {similar.length > 0 && (
        <section className="py-10">
          <div className="section-head">
            <h2>Similar by content</h2>
            <span className="label">TF-IDF cosine over product metadata</span>
          </div>
          <p className="mb-5 max-w-[76ch] text-[13px] leading-relaxed text-ink-2">
            The nearest neighbours of this item in the same item-item matrix the
            model&apos;s content half reads. Similarity is computed over title,
            brand and category text, so these are products described like this
            one, which is not the same thing as products bought with it.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {similar.map((p) => (
              <div key={p.id}>
                <ProductCard product={p} />
                <p className="label mt-1.5 text-right">
                  similarity{' '}
                  <span className="tnum text-ink-2">{formatScore(p.score)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
