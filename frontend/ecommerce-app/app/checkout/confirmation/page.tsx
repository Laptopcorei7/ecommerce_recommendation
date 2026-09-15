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
        <p className="label">Loading</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1400px] px-4">
        <div className="border-b-2 border-rule-heavy pb-4 pt-8">
          <p className="label mb-2">Confirmation</p>
          <h1 className="text-[26px] font-semibold">No order to show.</h1>
        </div>
        <p className="max-w-[58ch] py-8 text-[14px] leading-relaxed text-ink-2">
          Orders are kept in this browser only. If you have cleared site data,
          opened a private window, or arrived here directly, there is nothing to
          display.
        </p>
        <Link href="/catalog" className="btn">
          Browse the catalogue
        </Link>
      </div>
    )
  }

  const placed = new Date(order.placedAt)
  const count = order.lines.reduce((n, l) => n + l.qty, 0)

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="border-b-2 border-rule-heavy pb-5 pt-8">
        <p className="label mb-2">Confirmation</p>
        <h1 className="text-[26px] font-semibold">Order recorded</h1>
        <p className="mt-3 max-w-[64ch] text-[13.5px] leading-relaxed text-ink-2">
          Written to this browser. No payment was taken, nothing will be
          dispatched, and no one has been notified. Placing an order is the last
          step this system can honestly perform.
        </p>
      </div>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h2 className="label mb-3 border-b border-rule-heavy pb-1.5 text-ink">
            {formatCount(count)} {count === 1 ? 'item' : 'items'}
          </h2>
          {order.lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_110px] items-baseline gap-4 border-b border-rule py-2.5"
            >
              <Link href={`/product/${line.id}`} className="min-w-0">
                <span className="text-[13px] hover:text-signal">
                  {shortTitle(line.title, 90)}
                </span>
              </Link>
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

        <aside>
          <dl className="border border-rule bg-paper-sunk">
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
              <div
                key={term}
                className="flex items-baseline justify-between gap-4 border-b border-rule px-4 py-2 last:border-b-0"
              >
                <dt className="label">{term}</dt>
                <dd className="text-right font-mono tnum text-[12.5px] break-all">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <Link href="/recommendations" className="btn btn-line mt-4 w-full">
            See what the model suggests next
          </Link>
        </aside>
      </div>
    </div>
  )
}
