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
        <p className="meta">Loading</p>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="page-head">
          <p className="meta mb-3">Checkout</p>
          <h1 className="display">There is nothing to order.</h1>
        </div>
        <Link href="/catalog" className="btn">
          Shop the catalogue
        </Link>
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
    } catch (err) {
      // If storage is unavailable the confirmation page says so rather than
      // this step failing silently.
      console.error('Could not save the order to localStorage:', err)
    }
    clear()
    router.push('/checkout/confirmation')
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="page-head">
        <p className="meta mb-3">Checkout</p>
        <h1 className="display">Review the order</h1>
      </div>

      <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {/* The disclosure comes first, before the order lines, because it
              changes what the reader should expect from this page. */}
          <div className="mb-8 bg-volt px-5 py-5">
            <h2 className="display mb-2 text-[20px]">No payment is taken and nothing ships.</h2>
            <p className="max-w-[70ch] text-[14.5px] leading-relaxed">
              This catalogue is a dataset, not a shop. There is no payment
              processor behind this page and no address to deliver to, so it
              asks for neither. Placing the order writes a record in this
              browser and empties the cart, which is the honest extent of what
              the system does.
            </p>
          </div>

          <h2 className="display tnum mb-3 text-[18px]">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h2>
          <div className="space-y-1">
            {lines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_96px] items-baseline gap-4 bg-tile-soft px-4 py-3"
              >
                <span className="min-w-0 text-[14.5px]">{shortTitle(line.title, 90)}</span>
                <span className="tnum text-[13px] text-fg-3">×{line.qty}</span>
                <span className="tnum text-right text-[14.5px] font-bold">
                  {formatPrice((line.price ?? 0) * line.qty) ?? (
                    <span className="pill bg-bg">No price</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-[132px] lg:self-start">
          <div className="bg-tile p-5">
            <h2 className="display mb-4 text-[18px]">Total</h2>
            <dl className="space-y-2 text-[14.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-fg-2">Priced subtotal</dt>
                <dd className="tnum font-bold">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-2">Shipping</dt>
                <dd className="text-fg-3">Not applicable</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fg-2">Tax</dt>
                <dd className="text-fg-3">Not calculated</dd>
              </div>
            </dl>
            {unpriced > 0 && (
              <p className="mt-4 text-[13px] leading-relaxed text-fg-2">
                <span className="tnum font-bold text-alert">{unpriced}</span>{' '}
                {unpriced === 1 ? 'item has' : 'items have'} no price in the source
                data and {unpriced === 1 ? 'is' : 'are'} not in this total.
              </p>
            )}
            <button
              type="button"
              onClick={place}
              disabled={placing}
              className="btn btn-volt mt-5 w-full"
            >
              {placing ? 'Placing…' : 'Place order'}
            </button>
            <Link
              href="/cart"
              className="mt-4 block text-center text-[13px] font-semibold underline decoration-2 underline-offset-4"
            >
              Back to the cart
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
