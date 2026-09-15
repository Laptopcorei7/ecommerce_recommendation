'use client'

import Link from 'next/link'
import { useStore } from '@/app/providers'

/**
 * The cart link and its count.
 *
 * The count was previously `useState(3)` in the header and stayed at 3 no
 * matter what you did. It now reads the shared cart, and renders no number at
 * all until localStorage has been read, so it never flashes a wrong count on
 * first paint.
 */
export function CartLink() {
  const { count, ready } = useStore()

  return (
    <Link
      href="/cart"
      className="label flex items-center gap-1.5 hover:text-signal"
      aria-label={ready ? `Cart, ${count} items` : 'Cart'}
    >
      Cart
      <span
        className={`tnum inline-flex min-w-[18px] items-center justify-center px-1 py-0.5 text-[10px] ${
          ready && count > 0 ? 'bg-signal text-white' : 'bg-rule text-ink-3'
        }`}
      >
        {ready ? count : '·'}
      </span>
    </Link>
  )
}
