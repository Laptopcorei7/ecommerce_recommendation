'use client'

import { useEffect, useRef, useState } from 'react'
import type { Product } from '@/lib/catalog-types'
import { useStore } from '@/app/providers'

/**
 * Add to cart, with the result confirmed in place.
 *
 * The button reports what happened by becoming "added" for a moment rather
 * than firing a toast into the corner. The action happened here, so the
 * feedback belongs here, and a row of these in a list would otherwise stack
 * four toasts for four clicks.
 */
export function AddToCart({
  product,
  qty = 1,
  full = false,
  label = 'Add',
}: {
  product: Product
  qty?: number
  full?: boolean
  label?: string
}) {
  const { add, ready } = useStore()
  const [done, setDone] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A click immediately before navigating away would otherwise set state on an
  // unmounted component.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <button
      type="button"
      className={`btn ${full ? 'w-full' : ''}`}
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
        setDone(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? 'Added ✓' : label}
    </button>
  )
}
