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
      <nav className="meta flex flex-wrap gap-2 py-5" aria-label="Breadcrumb">
        <Link href="/catalog" className="hover:underline">
          Catalogue
        </Link>
        {product.category_slug && (
          <span className="flex gap-2">
            <span aria-hidden>/</span>
            <Link href={`/categories/${product.category_slug}`} className="hover:underline">
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

      <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)_320px]">
        {/* ---- image ---- */}
        <div className="aspect-square">
          <ProductImage
            src={product.image}
            alt={product.title}
            id={product.id}
            sizes="(max-width: 1024px) 100vw, 480px"
            priority
          />
        </div>

        {/* ---- identity ---- */}
        <div className="min-w-0">
          {brand && <p className="pill mb-3">{brand}</p>}
          {/* Titles run to 300 characters, so the title is set in the reading
              voice, left aligned and allowed to wrap, never in the display
              voice. */}
          <h1 className="text-[22px] font-bold leading-snug sm:text-[24px]">{product.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Rating
              value={product.average_rating}
              count={product.rating_number}
              showCount={false}
            />
            <span className="text-[14px] text-fg-2">
              <span className="tnum font-semibold text-fg">
                {formatCount(product.rating_number)}
              </span>{' '}
              ratings
            </span>
          </div>

          {/* A specification table. Every row is a field that exists on the
              record; nothing here is invented copy. */}
          <dl className="mt-6">
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
                className="grid grid-cols-[128px_minmax(0,1fr)] gap-4 px-3 py-2.5 odd:bg-tile-soft"
              >
                <dt className="text-[13px] font-semibold">{term}</dt>
                <dd className="break-words text-[14px] text-fg-2">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="meta mt-4 max-w-[68ch] leading-relaxed">
            Fields come from the Amazon Reviews 2023 product metadata exactly as
            published. There is no description here because the source has none
            for this record, and writing one would be inventing it.
          </p>
        </div>

        {/* ---- buy ---- */}
        <div className="lg:sticky lg:top-[132px] lg:self-start">
          <BuyBox product={product} />
        </div>
      </div>

      {/* ---- similar ---- */}
      {similar.length > 0 && (
        <section className="py-14">
          <div className="section-head">
            <h2 className="display">Similar by content</h2>
            <p className="mx-auto max-w-[76ch]">
              The nearest neighbours of this item in the TF-IDF item-item matrix
              the model&apos;s content half reads. Similarity is computed over
              title, brand and category text, so these are products described like
              this one, which is not the same thing as products bought with it.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {similar.map((p) => (
              <div key={p.id} className="flex flex-col">
                <ProductCard product={p} />
                <p className="meta tnum mt-2">
                  Similarity <span className="font-semibold text-fg">{formatScore(p.score)}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
