/**
 * The four primitives every product surface is built from.
 *
 * They live together because they encode one shared set of decisions about
 * this dataset, and splitting them across four files would let those decisions
 * drift apart.
 */

import Image from 'next/image'
import { formatCount, formatPrice, formatRating } from '@/lib/format'

/* -------------------------------------------------------------- image tile */

/**
 * Every product photo here is an Amazon cutout on a white background, and 3 of
 * 62,222 records have no image at all.
 *
 * The photo sits on a grey tile, and `mix-blend-mode: multiply` in globals.css
 * turns its white box into the tile colour, so the object stands on the tile
 * with no second edge around it.
 *
 * The missing-image case shows the part number rather than a camera glyph.
 * The id is the one true thing available.
 */
export function ProductImage({
  src,
  alt,
  id,
  sizes = '200px',
  priority = false,
}: {
  src: string | null
  alt: string
  id: string
  sizes?: string
  priority?: boolean
}) {
  if (!src) {
    return (
      <div className="tile h-full w-full">
        <span className="meta px-2 text-center">
          No image
          <br />
          {id}
        </span>
      </div>
    )
  }
  return (
    <div className="tile h-full w-full">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-contain p-[8%]"
      />
    </div>
  )
}

/* -------------------------------------------------------------------- price */

/**
 * 45.2% of this catalogue has no price.
 *
 * That is too much of it to paper over with a dash, and far too much to render
 * as $0.00. An unpriced product says so in a pill, so a grid of them reads as
 * a known gap in the data rather than as broken layout.
 */
export function Price({
  value,
  size = 'md',
}: {
  value: number | null | undefined
  size?: 'sm' | 'md' | 'lg'
}) {
  const formatted = formatPrice(value)
  const scale =
    size === 'lg' ? 'text-[30px]' : size === 'sm' ? 'text-[13px]' : 'text-[17px]'

  if (!formatted) {
    return (
      <span className="pill" title="This product has no price in the source data">
        No price
      </span>
    )
  }
  return <span className={`tnum font-bold ${scale}`}>{formatted}</span>
}

/* ------------------------------------------------------------------- rating */

/**
 * A number and a bar, not five stars.
 *
 * Stars round 4.3 and 4.7 to the same picture. The bar is proportional, so they
 * look different, and the count sits next to it because on this data the
 * count is the more useful of the two: ratings cluster hard around 4.5, while
 * counts range from 0 to 349,254.
 */
export function Rating({
  value,
  count,
  showCount = true,
}: {
  value: number | null | undefined
  count?: number | null
  showCount?: boolean
}) {
  if (value === null || value === undefined) {
    return <span className="meta">Unrated</span>
  }
  const pct = Math.max(0, Math.min(100, (value / 5) * 100))
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className="tnum text-[13px] font-semibold">{formatRating(value)}</span>
      <span
        className="relative inline-block h-1.5 w-10 overflow-hidden rounded-full bg-tile-2"
        role="img"
        aria-label={`${formatRating(value)} out of 5`}
      >
        <span className="absolute inset-y-0 left-0 bg-fg" style={{ width: `${pct}%` }} />
      </span>
      {showCount && count !== null && count !== undefined && (
        <span className="meta tnum">{formatCount(count)} ratings</span>
      )}
    </span>
  )
}

/* ------------------------------------------------------------- score split */

/**
 * What actually drove a recommendation.
 *
 * The blend is `alpha * collaborative + (1 - alpha) * content`, both halves
 * standardized, and the API returns the two weighted terms so they sum to the
 * score. Drawing them as a split bar makes the model's real behaviour visible:
 * the collaborative half does very nearly all of the work and the content
 * half contributes almost nothing. The alpha control on the recommendations
 * page lets a reader confirm it rather than take it on trust.
 *
 * Bars are drawn against the strongest score in the list, so the first row is
 * always full width and the rest are read relative to it.
 */
export function ScoreSplit({
  collaborative,
  content,
  max,
}: {
  collaborative: number
  content: number
  max: number
}) {
  const scale = max > 0 ? 100 / max : 0
  // Only positive contributions get width. A negative half pushed the item
  // down, so drawing it as a bar segment would misread as support.
  const c = Math.max(0, collaborative) * scale
  const k = Math.max(0, content) * scale

  return (
    <span
      className="flex h-2 w-full overflow-hidden rounded-full bg-tile-2"
      role="img"
      aria-label={`collaborative ${collaborative.toFixed(3)}, content ${content.toFixed(3)}`}
    >
      <span className="bg-collab" style={{ width: `${Math.min(c, 100)}%` }} />
      <span className="bg-content" style={{ width: `${Math.min(k, 100 - c)}%` }} />
    </span>
  )
}
