'use client'

import Link from 'next/link'
import { formatCount, formatPrice, shortTitle } from '@/lib/format'
import { useStore } from '@/app/providers'
import { ProductImage } from '@/components/product-bits'

/**
 * The cart.
 *
 * Previously this page listed two hardcoded products regardless of what you
 * had added, and adding something from anywhere else changed nothing here. It
 * now reads the shared, persisted cart.
 *
 * The subtotal is the honest part. Forty-five percent of this catalogue has no
 * price, so a cart can contain items that cannot be totalled. Those are listed,
 * counted, and named in the summary rather than silently added as $0.00.
 */
export default function CartPage() {
  const { lines, ready, count, subtotal, unpriced, setQty, remove, clear } = useStore()

  if (!ready) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16">
        <p className="meta">Loading your cart</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="page-head">
          <p className="meta mb-3">Cart</p>
          <h1 className="display">Nothing in the cart.</h1>
        </div>
        <p className="max-w-[52ch] text-[16px] leading-relaxed text-fg-2">
          Add something from the catalogue, or let the recommender pick for one
          of the shoppers the model was trained on.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/catalog" className="btn">
            Shop the catalogue
          </Link>
          <Link href="/recommendations" className="btn btn-volt">
            Run the recommender
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="page-head flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="meta mb-3">Cart</p>
          <h1 className="display tnum">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h1>
        </div>
        <button type="button" onClick={clear} className="btn btn-line btn-sm">
          Empty the cart
        </button>
      </div>

      <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---- lines ---- */}
        <div className="space-y-2">
          {lines.map((line) => {
            const price = formatPrice(line.price)
            const lineTotal = formatPrice((line.price ?? 0) * line.qty)
            const name = shortTitle(line.title, 40)
            return (
              <div
                key={line.id}
                className="grid grid-cols-[80px_minmax(0,1fr)] items-start gap-4 bg-tile-soft p-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:p-4"
              >
                <Link href={`/product/${line.id}`} className="block aspect-square">
                  <ProductImage src={line.image} alt={line.title} id={line.id} sizes="96px" />
                </Link>

                <div className="min-w-0">
                  {line.store && <p className="mb-1 text-[12.5px] font-semibold">{line.store}</p>}
                  <Link href={`/product/${line.id}`} className="block">
                    <h2 className="text-[15px] leading-snug hover:underline">
                      {shortTitle(line.title, 130)}
                    </h2>
                  </Link>
                  <p className="meta tnum mt-1">{line.id}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex h-9 items-center rounded-full bg-bg">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[16px] font-bold hover:bg-tile-2"
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label={`Decrease quantity of ${name}`}
                      >
                        −
                      </button>
                      <span className="tnum w-7 text-center text-[14px] font-bold">{line.qty}</span>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[16px] font-bold hover:bg-tile-2 disabled:text-fg-3"
                        onClick={() => setQty(line.id, line.qty + 1)}
                        disabled={line.qty >= 99}
                        aria-label={`Increase quantity of ${name}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      className="text-[13px] font-semibold underline decoration-2 underline-offset-4 hover:decoration-volt"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="col-span-2 flex items-baseline justify-between gap-3 sm:col-span-1 sm:block sm:w-[110px] sm:text-right">
                  {price ? (
                    <>
                      <div className="tnum text-[17px] font-bold">{lineTotal}</div>
                      {line.qty > 1 && <div className="meta tnum mt-1">{price} each</div>}
                    </>
                  ) : (
                    <span className="pill bg-bg">No price</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ---- summary ---- */}
        <aside className="lg:sticky lg:top-[132px] lg:self-start">
          <div className="bg-tile p-5">
            <h2 className="display mb-4 text-[18px]">Summary</h2>
            <dl className="space-y-2 text-[14.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-2">Items</dt>
                <dd className="tnum font-semibold">{formatCount(count)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-2">Priced subtotal</dt>
                <dd className="tnum font-bold">{formatPrice(subtotal)}</dd>
              </div>
              {unpriced > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-fg-2">Unpriced items</dt>
                  <dd className="tnum font-bold text-alert">{formatCount(unpriced)}</dd>
                </div>
              )}
            </dl>

            {unpriced > 0 && (
              <p className="mt-4 text-[13px] leading-relaxed text-fg-2">
                {unpriced === count ? 'Every item' : `${formatCount(unpriced)} of these items`}{' '}
                {unpriced === 1 ? 'has' : 'have'} no price in the source data, so
                the subtotal above does not include {unpriced === 1 ? 'it' : 'them'}.
              </p>
            )}

            <Link href="/checkout" className="btn btn-volt mt-5 w-full">
              Checkout
            </Link>
            <Link
              href="/catalog"
              className="mt-4 block text-center text-[13px] font-semibold underline decoration-2 underline-offset-4"
            >
              Keep browsing
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
