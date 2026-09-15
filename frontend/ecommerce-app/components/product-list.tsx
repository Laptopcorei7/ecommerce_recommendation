import Link from 'next/link'
import type { Product } from '@/lib/catalog-types'
import { formatBrand, formatScore } from '@/lib/format'
import { AddToCart } from '@/components/add-to-cart'
import { Price, ProductImage, Rating, ScoreSplit } from '@/components/product-bits'

/**
 * Two ways to show a product, and the rules they share.
 *
 * Rows are the default. Titles here run to 111 characters at the median, and a
 * row gives a title the full width of the page to run in, where a grid cell
 * would clip most of it. Grid exists for the moments when the photograph is
 * what you are scanning for, and the catalogue page lets the reader choose.
 *
 * Neither centres anything. Centred text sets a ragged left edge on every line
 * of a 111-character title, which is unreadable at this length.
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

  return (
    <div className="row-reveal grid grid-cols-[auto_88px_minmax(0,1fr)_auto] items-start gap-x-4 border-b border-rule py-4 hover:bg-paper-sunk/45">
      {/* Rank. A fixed-width mono column so the list reads as an ordering. */}
      <div className="w-7 pt-0.5">
        {rank !== undefined && (
          <span className="font-mono tnum text-[12px] text-ink-3">
            {String(rank).padStart(2, '0')}
          </span>
        )}
      </div>

      <Link href={`/product/${product.id}`} className="block aspect-square w-[88px]">
        <ProductImage
          src={product.image}
          alt={product.title}
          id={product.id}
          sizes="88px"
        />
      </Link>

      <div className="min-w-0">
        {(brand || product.category_slug) && (
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {brand && <span className="label text-ink-2">{brand}</span>}
            {product.category_slug && (
              <Link
                href={`/categories/${product.category_slug}`}
                className="label hover:text-signal"
              >
                {product.category_name}
              </Link>
            )}
          </div>
        )}

        <Link href={`/product/${product.id}`} className="block">
          <h3 className="line-clamp-2 text-[13.5px] leading-snug hover:text-signal">
            {product.title}
          </h3>
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Rating value={product.average_rating} count={product.rating_number} />
          <span className="font-mono tnum text-[11px] text-ink-3">{product.id}</span>
        </div>

        {/* The model's own reasoning, shown only where there is one. */}
        {scored && scoreMax !== undefined && (
          <div className="mt-2 max-w-[280px]">
            <ScoreSplit
              collaborative={product.collaborative ?? 0}
              content={product.content ?? 0}
              max={scoreMax}
            />
            <div className="mt-1 flex gap-3">
              <span className="label">
                score <span className="tnum text-ink-2">{formatScore(product.score)}</span>
              </span>
              <span className="label text-collab">
                collab <span className="tnum">{formatScore(product.collaborative)}</span>
              </span>
              <span className="label text-content">
                content <span className="tnum">{formatScore(product.content)}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex w-[130px] flex-col items-end gap-2 pt-0.5">
        <Price value={product.price} />
        <div className="reveal">
          <AddToCart product={product} />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- card */

export function ProductCard({ product }: { product: Product }) {
  const brand = formatBrand(product.store)

  return (
    <div className="row-reveal flex flex-col border border-rule bg-paper p-3 hover:border-rule-2">
      <Link href={`/product/${product.id}`} className="mb-3 block aspect-square">
        <ProductImage
          src={product.image}
          alt={product.title}
          id={product.id}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
        />
      </Link>

      {brand && <div className="label mb-1 text-ink-2">{brand}</div>}

      <Link href={`/product/${product.id}`} className="block">
        <h3 className="line-clamp-3 text-[13px] leading-snug hover:text-signal">
          {product.title}
        </h3>
      </Link>

      <div className="mt-2">
        <Rating value={product.average_rating} count={product.rating_number} />
      </div>

      {/* mt-auto pins the price row to the bottom so a grid of cards with
          two-line and three-line titles still aligns along its price line. */}
      <div className="mt-auto flex items-baseline justify-between gap-2 pt-3">
        <Price value={product.price} />
        <div className="reveal">
          <AddToCart product={product} />
        </div>
      </div>
    </div>
  )
}
