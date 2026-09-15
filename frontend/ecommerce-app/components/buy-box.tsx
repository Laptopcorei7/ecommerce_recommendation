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
    <div className="bg-tile p-5">
      <Price value={product.price} size="lg" />
      {!unitPrice && (
        <p className="mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-fg-2">
          This record has no price in the source data. It can still go in the
          cart; the cart will list it and leave it out of the total.
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <div className="flex h-11 items-center rounded-full bg-bg">
          <button
            type="button"
            className="flex h-11 w-10 items-center justify-center rounded-full text-[18px] font-bold hover:bg-tile-2 disabled:text-fg-3"
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
            className="tnum w-8 bg-transparent text-center text-[15px] font-bold outline-none"
          />
          <button
            type="button"
            className="flex h-11 w-10 items-center justify-center rounded-full text-[18px] font-bold hover:bg-tile-2 disabled:text-fg-3"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            disabled={qty >= 99}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="btn btn-volt h-11 flex-1"
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
        <p className="mt-4 text-[14px]">
          <span className="tnum font-bold">{inCart}</span> in your cart.{' '}
          <Link href="/cart" className="link">
            Go to cart
          </Link>
        </p>
      )}
    </div>
  )
}
