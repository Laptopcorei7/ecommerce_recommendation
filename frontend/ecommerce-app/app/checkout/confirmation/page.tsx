'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatCount, formatPrice, shortTitle } from '@/lib/format'
import { readOrder, type Order } from '@/lib/order'

/**
 * What used to be `alert('Order placed!')`.
 *
 * An order record exists now, so there is something real to show: its id, when
 * it was placed, and exactly what was in it. It is read after mount rather
 * than during render, since localStorage does not exist on the server.
 */
export default function ConfirmationPage() {
  const [order, setOrder] = useState<Order | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setOrder(readOrder())
    setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16">
        <p className="meta">Loading</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="page-head">
          <p className="meta mb-3">Confirmation</p>
          <h1 className="display">No order to show.</h1>
        </div>
        <p className="mb-8 max-w-[58ch] text-[16px] leading-relaxed text-fg-2">
          Orders are kept in this browser only. If you have cleared site data,
          opened a private window, or arrived here directly, there is nothing to
          display.
        </p>
        <Link href="/catalog" className="btn">
          Shop the catalogue
        </Link>
      </div>
    )
  }

  const placed = new Date(order.placedAt)
  const count = order.lines.reduce((n, l) => n + l.qty, 0)

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="page-head">
        <p className="meta mb-3">Confirmation</p>
        <h1 className="display">Order recorded</h1>
        <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-fg-2">
          Written to this browser. No payment was taken, nothing will be
          dispatched, and no one has been notified. Placing an order is the last
          step this system can honestly perform.
        </p>
      </div>

      <div className="grid gap-8 pb-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h2 className="display tnum mb-3 text-[18px]">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h2>
          <div className="space-y-1">
            {order.lines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[minmax(0,1fr)_auto_96px] items-baseline gap-4 bg-tile-soft px-4 py-3"
              >
                <Link href={`/product/${line.id}`} className="min-w-0 text-[14.5px] hover:underline">
                  {shortTitle(line.title, 90)}
                </Link>
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

        <aside>
          <dl className="space-y-2 bg-tile p-5 text-[14.5px]">
            {[
              ['Order', order.id],
              ['Placed', placed.toLocaleString()],
              ['Items', formatCount(count)],
              ['Priced total', formatPrice(order.subtotal) ?? '—'],
              ...(order.unpriced > 0
                ? ([['Unpriced', formatCount(order.unpriced)]] as [string, string][])
                : []),
              ['Payment', 'None taken'],
              ['Delivery', 'Not applicable'],
            ].map(([term, value]) => (
              <div key={term} className="flex items-baseline justify-between gap-4">
                <dt className="text-fg-2">{term}</dt>
                <dd className="tnum break-all text-right font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <Link href="/recommendations" className="btn btn-volt mt-4 w-full whitespace-normal text-center">
            See what the model suggests next
          </Link>
        </aside>
      </div>
    </div>
  )
}
