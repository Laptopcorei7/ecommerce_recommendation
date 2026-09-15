import type { Metadata } from 'next'

/**
 * Metadata for a client-rendered route.
 *
 * The page itself is a client component, because it reads the cart from
 * localStorage, and a client component cannot export metadata. This layout
 * exists solely to give the route a title instead of letting it inherit the
 * site default.
 */
export const metadata: Metadata = {
  title: 'Order recorded',
  description: 'The order this browser has on file.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
