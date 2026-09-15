'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatCount, formatPrice, shortTitle } from '@/lib/format'
import { useStore } from '@/app/providers'
import { newOrderId, ORDER_KEY, type Order } from '@/lib/order'

/**
 * Checkout.
 *
 * The previous version rendered a full payment form, card number and CVV
 * included, and then ended in `alert('Order placed!')`. Nothing was submitted
 * anywhere. That is worse than having no checkout: it asks for card details
 * under a pretence, and a form that looks real teaches people to type real
 * numbers into it.
 *
 * There is no payment backend in this project and nothing ships, so this page
 * says so and takes no payment details at all. What it does instead is real:
 * it writes an order record, empties the cart, and hands you a confirmation
 * page you can come back to. That is the whole of what this system can
 * honestly do, and doing it properly is better than simulating more.
 */

export default function CheckoutPage() {
  const router = useRouter()
  const { lines, ready, count, subtotal, unpriced, clear } = useStore()
  const [placing, setPlacing] = useState(false)

  if (!ready) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16">
        <p className="label">Loading</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="border-b-2 border-rule-heavy pb-4 pt-8">
          <p className="label mb-2">Checkout</p>
          <h1 className="text-[26px] font-semibold">There is nothing to order.</h1>
        </div>
        <div className="py-12">
          <Link href="/catalog" className="btn">
            Browse the catalogue
          </Link>
        </div>
      </div>
    )
  }

  const place = () => {
    setPlacing(true)
    const order: Order = {
      id: newOrderId(),
      placedAt: new Date().toISOString(),
      lines,
      subtotal,
      unpriced,
    }
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(order))
    } catch {
      // If storage is unavailable the confirmation page says so rather than
      // this step failing silently.
    }
    clear()
    router.push('/checkout/confirmation')
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="border-b-2 border-rule-heavy pb-4 pt-8">
        <p className="label mb-2">Checkout</p>
        <h1 className="text-[26px] font-semibold">Review the order</h1>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {/* The disclosure comes first, before the order lines, because it
              changes what the reader should expect from this page. */}
          <div className="mb-8 border-l-2 border-signal bg-signal-tint px-4 py-3">
            <h2 className="mb-1.5 text-[13.5px] font-semibold">
              No payment is taken and nothing ships.
            </h2>
            <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-2">
              This catalogue is a dataset, not a shop. There is no payment
              processor behind this page and no address to deliver to, so it
              asks for neither. Placing the order writes a record in this
              browser and empties the cart, which is the honest extent of what
              the system does.
            </p>
          </div>

          <h2 className="label mb-3 border-b border-rule-heavy pb-1.5 text-ink">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h2>
          <div>
            {lines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_110px] items-baseline gap-4 border-b border-rule py-2.5"
              >
                <span className="min-w-0 text-[13px]">
                  {shortTitle(line.title, 90)}
                </span>
                <span className="font-mono tnum text-[12px] text-ink-3">
                  ×{line.qty}
                </span>
                <span className="text-right font-mono tnum text-[13px]">
                  {formatPrice((line.price ?? 0) * line.qty) ?? (
                    <span className="label">no price</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-[150px] lg:self-start">
          <div className="border border-rule bg-paper-sunk">
            <h2 className="label border-b border-rule px-4 py-2.5 text-ink">
              Total
            </h2>
            <dl className="px-4 py-3 text-[13px]">
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-ink-2">Priced subtotal</dt>
                <dd className="font-mono tnum">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-ink-2">Shipping</dt>
                <dd className="label">not applicable</dd>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-ink-2">Tax</dt>
                <dd className="label">not calculated</dd>
              </div>
              {unpriced > 0 && (
                <div className="mt-2 border-t border-rule pt-2">
                  <p className="text-[12px] leading-relaxed text-ink-2">
                    <span className="font-mono tnum text-signal">{unpriced}</span>{' '}
                    {unpriced === 1 ? 'item has' : 'items have'} no price in the
                    source data and {unpriced === 1 ? 'is' : 'are'} not in this
                    total.
                  </p>
                </div>
              )}
            </dl>
            <div className="border-t border-rule p-4">
              <button
                type="button"
                onClick={place}
                disabled={placing}
                className="btn w-full"
              >
                {placing ? 'Placing…' : 'Place order'}
              </button>
              <Link
                href="/cart"
                className="label mt-3 block text-center hover:text-signal"
              >
                Back to the cart
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
