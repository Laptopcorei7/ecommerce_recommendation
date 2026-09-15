'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Product } from '@/lib/catalog-types'
import { formatPrice } from '@/lib/format'
import { useStore } from '@/app/providers'
import { Price } from '@/components/product-bits'

/**
 * Price, quantity and the add action on a product page.
 *
 * Quantity is a stepper rather than a select, because a select of 1-10 is a
 * cap invented by the component and nothing here has stock levels to justify
 * one. The upper bound of 99 is the cart's, and it is enforced in the store
 * rather than only in this control.
 *
 * When a product has no price, the button still works. Forty-five percent of
 * this catalogue is unpriced and refusing to let those into the cart would
 * make most of it unusable, so the cart carries the gap forward instead and
 * says what it cannot total.
 */
export function BuyBox({ product }: { product: Product }) {
  const { add, ready, lines } = useStore()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  const inCart = lines.find((l) => l.id === product.id)?.qty ?? 0
  const unitPrice = formatPrice(product.price)

  return (
    <div className="border border-rule bg-paper-sunk">
      <div className="border-b border-rule px-4 py-3">
        <div className="label mb-1.5">Price</div>
        <Price value={product.price} size="lg" />
        {!unitPrice && (
          <p className="mt-2 max-w-[34ch] text-[12px] leading-relaxed text-ink-2">
            This record has no price in the source data. It can still go in the
            cart; the cart will list it and leave it out of the total.
          </p>
        )}
      </div>

      <div className="flex items-end gap-3 px-4 py-3">
        <div>
          <div className="label mb-1.5">Quantity</div>
          <div className="flex w-[104px]">
            <button
              type="button"
              className="btn btn-line px-2"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10)
                setQty(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1)
              }}
              aria-label="Quantity"
              className="field tnum w-full border-x-0 px-0 text-center font-mono text-[13px]"
            />
            <button
              type="button"
              className="btn btn-line px-2"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              disabled={qty >= 99}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn flex-1"
          disabled={!ready}
          onClick={() => {
            add(
              {
                id: product.id,
                title: product.title,
                price: product.price,
                image: product.image,
                store: product.store,
              },
              qty,
            )
            setAdded(true)
          }}
        >
          Add to cart
        </button>
      </div>

      {added && inCart > 0 && (
        <p className="border-t border-rule px-4 py-2.5 text-[12.5px]">
          <span className="tnum font-mono">{inCart}</span> in your cart.{' '}
          <Link href="/cart" className="link">
            Go to cart
          </Link>
        </p>
      )}
    </div>
  )
}
