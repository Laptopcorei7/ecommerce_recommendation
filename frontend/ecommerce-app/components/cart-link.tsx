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
  const filled = ready && count > 0

  return (
    <Link
      href="/cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-tile"
      aria-label={ready ? `Cart, ${count} items` : 'Cart'}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.5" cy="19.5" r="1.5" fill="currentColor" />
        <circle cx="17" cy="19.5" r="1.5" fill="currentColor" />
      </svg>
      <span
        className={`tnum absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-bg px-1 text-[10.5px] font-bold ${
          filled ? 'bg-volt text-fg' : 'bg-tile text-fg-3'
        }`}
      >
        {ready ? count : ''}
      </span>
    </Link>
  )
}
