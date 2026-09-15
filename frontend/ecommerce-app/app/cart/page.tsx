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
        <p className="label">Loading your cart</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="border-b-2 border-rule-heavy pb-4 pt-8">
          <p className="label mb-2">Cart</p>
          <h1 className="text-[26px] font-semibold">Nothing in the cart.</h1>
        </div>
        <div className="py-12">
          <p className="max-w-[52ch] text-[14px] leading-relaxed text-ink-2">
            Add something from the catalogue, or let the recommender pick for
            one of the shoppers the model was trained on.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn">
              Browse the catalogue
            </Link>
            <Link href="/recommendations" className="btn btn-line">
              Run the recommender
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-rule-heavy pb-4 pt-8">
        <div>
          <p className="label mb-2">Cart</p>
          <h1 className="text-[26px] font-semibold">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h1>
        </div>
        <button type="button" onClick={clear} className="label hover:text-signal">
          Empty the cart
        </button>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---- lines ---- */}
        <div className="border-t border-rule">
          {lines.map((line) => {
            const price = formatPrice(line.price)
            const lineTotal = formatPrice((line.price ?? 0) * line.qty)
            return (
              <div
                key={line.id}
                className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-start gap-4 border-b border-rule py-4"
              >
                <Link href={`/product/${line.id}`} className="block aspect-square w-[72px]">
                  <ProductImage
                    src={line.image}
                    alt={line.title}
                    id={line.id}
                    sizes="72px"
                  />
                </Link>

                <div className="min-w-0">
                  {line.store && <p className="label mb-1 text-ink-2">{line.store}</p>}
                  <Link href={`/product/${line.id}`} className="block">
                    <h2 className="text-[13.5px] leading-snug hover:text-signal">
                      {shortTitle(line.title, 130)}
                    </h2>
                  </Link>
                  <p className="mt-1 font-mono tnum text-[11px] text-ink-3">
                    {line.id}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex w-[96px]">
                      <button
                        type="button"
                        className="btn btn-line px-2"
                        onClick={() => setQty(line.id, line.qty - 1)}
                        aria-label={`Decrease quantity of ${shortTitle(line.title, 40)}`}
                      >
                        −
                      </button>
                      <span className="field tnum flex-1 border-x-0 px-0 text-center font-mono text-[13px]">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        className="btn btn-line px-2"
                        onClick={() => setQty(line.id, line.qty + 1)}
                        disabled={line.qty >= 99}
                        aria-label={`Increase quantity of ${shortTitle(line.title, 40)}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      className="label hover:text-signal"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="w-[110px] text-right">
                  {price ? (
                    <>
                      <div className="font-mono tnum text-[15px] font-medium">
                        {lineTotal}
                      </div>
                      {line.qty > 1 && (
                        <div className="label mt-1">{price} each</div>
                      )}
                    </>
                  ) : (
                    <span className="label">no price</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ---- summary ---- */}
        <aside className="lg:sticky lg:top-[150px] lg:self-start">
          <div className="border border-rule bg-paper-sunk">
            <h2 className="label border-b border-rule px-4 py-2.5 text-ink">
              Summary
            </h2>
            <dl className="px-4 py-3 text-[13px]">
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-ink-2">Items</dt>
                <dd className="font-mono tnum">{formatCount(count)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-ink-2">Priced subtotal</dt>
                <dd className="font-mono tnum">{formatPrice(subtotal)}</dd>
              </div>
              {unpriced > 0 && (
                <div className="flex justify-between gap-4 py-1">
                  <dt className="text-ink-2">Unpriced items</dt>
                  <dd className="font-mono tnum text-signal">
                    {formatCount(unpriced)}
                  </dd>
                </div>
              )}
            </dl>

            {unpriced > 0 && (
              <p className="border-t border-rule px-4 py-3 text-[12px] leading-relaxed text-ink-2">
                {unpriced === count ? 'Every item' : `${formatCount(unpriced)} of these items`}{' '}
                {unpriced === 1 ? 'has' : 'have'} no price in the source data, so
                the subtotal above does not include{' '}
                {unpriced === 1 ? 'it' : 'them'}.
              </p>
            )}

            <div className="border-t border-rule p-4">
              <Link href="/checkout" className="btn w-full">
                Checkout
              </Link>
              <Link
                href="/catalog"
                className="label mt-3 block text-center hover:text-signal"
              >
                Keep browsing
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
