import Link from 'next/link'
import type { Product } from '@/lib/catalog-types'
import { formatBrand, formatScore } from '@/lib/format'
import { AddToCart } from '@/components/add-to-cart'
import { Price, ProductImage, Rating, ScoreSplit } from '@/components/product-bits'

/**
 * Two ways to show a product, and the rules they share.
 *
 * Rows are the default. Titles here run to 111 characters at the median, and a
 * row gives a title the full width of the page, where a grid cell would clip
 * most of it. The card is the merch tile: a large grey square with the cutout
 * on it, for when the photograph is what you are scanning for.
 *
 * Titles are never centred and never set in the display voice. A centred or
 * wide-set 111-character title is unreadable.
 */

/* --------------------------------------------------------------------- row */

export function ProductRow({
  product,
  rank,
  scoreMax,
}: {
  product: Product
  /** Position in a ranked list. Shown only when there is a ranking. */
  rank?: number
  /** Top score in the list, so the split bars share one scale. */
  scoreMax?: number
}) {
  const brand = formatBrand(product.store)
  const scored = product.score !== null && product.score !== undefined
  const ranked = rank !== undefined

  return (
    <div
      className={`row-reveal grid items-start gap-x-4 gap-y-3 bg-tile-soft p-3 sm:p-4 ${
        ranked
          ? 'grid-cols-[auto_88px_minmax(0,1fr)] sm:grid-cols-[auto_104px_minmax(0,1fr)_auto]'
          : 'grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[104px_minmax(0,1fr)_auto]'
      }`}
    >
      {ranked && (
        <div className="display tnum w-10 pt-1 text-[26px] sm:w-14 sm:text-[34px]">
          {String(rank).padStart(2, '0')}
        </div>
      )}

      <Link href={`/product/${product.id}`} className="block aspect-square">
        <ProductImage src={product.image} alt={product.title} id={product.id} sizes="104px" />
      </Link>

      <div className="min-w-0">
        {(brand || product.category_slug) && (
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {brand && <span className="text-[12.5px] font-semibold">{brand}</span>}
            {product.category_slug && (
              <Link
                href={`/categories/${product.category_slug}`}
                className="pill bg-bg hover:bg-volt"
              >
                {product.category_name}
              </Link>
            )}
          </div>
        )}

        <Link href={`/product/${product.id}`} className="block">
          <h3 className="line-clamp-2 text-[15px] font-medium leading-snug hover:underline">
            {product.title}
          </h3>
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Rating value={product.average_rating} count={product.rating_number} />
          <span className="meta tnum">{product.id}</span>
        </div>

        {/* The model's own reasoning, shown only where there is one. */}
        {scored && scoreMax !== undefined && (
          <div className="mt-3 max-w-[320px]">
            <ScoreSplit
              collaborative={product.collaborative ?? 0}
              content={product.content ?? 0}
              max={scoreMax}
            />
            <div className="meta tnum mt-1.5 flex flex-wrap gap-x-3">
              <span>
                Score <span className="font-semibold text-fg">{formatScore(product.score)}</span>
              </span>
              <span>Similar shoppers {formatScore(product.collaborative)}</span>
              <span>Similar products {formatScore(product.content)}</span>
            </div>
          </div>
        )}
      </div>

      <div
        className={`flex items-center justify-between gap-3 sm:w-[130px] sm:flex-col sm:items-end sm:justify-start ${
          ranked ? 'col-span-3 sm:col-span-1' : 'col-span-2 sm:col-span-1'
        }`}
      >
        <Price value={product.price} />
        <div className="reveal">
          <AddToCart product={product} small />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- card */

export function ProductCard({ product }: { product: Product }) {
  const brand = formatBrand(product.store)

  return (
    <div className="row-reveal flex flex-col">
      <Link href={`/product/${product.id}`} className="mb-3 block aspect-square">
        <ProductImage
          src={product.image}
          alt={product.title}
          id={product.id}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 440px"
        />
      </Link>

      {brand && <div className="mb-1 text-[12.5px] font-semibold">{brand}</div>}

      <Link href={`/product/${product.id}`} className="block">
        <h3 className="line-clamp-3 text-[14.5px] leading-snug hover:underline">
          {product.title}
        </h3>
      </Link>

      <div className="mt-2">
        <Rating value={product.average_rating} count={product.rating_number} />
      </div>

      {/* mt-auto pins the price row to the bottom so cards with two-line and
          three-line titles still align along their price line. */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <Price value={product.price} />
        <div className="reveal">
          <AddToCart product={product} small />
        </div>
      </div>
    </div>
  )
}
