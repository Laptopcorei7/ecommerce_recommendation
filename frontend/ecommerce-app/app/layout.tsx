import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getCategories, getHealth, type Category } from '@/lib/api'

/**
 * IBM Plex, sans and mono.
 *
 * Plex was drawn for IBM's technical documentation, which is the register this
 * catalogue is written in, and the two faces are metrically related so a mono
 * part number sits on the same baseline as the sans title beside it. That
 * pairing is the whole typographic system: sans for prose, mono for anything
 * measured.
 */
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
})

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'ElectroHub — electronics catalogue',
    template: '%s — ElectroHub',
  },
  description:
    'A catalogue of 62,222 electronics products with recommendations from a ' +
    'hybrid model fitted on the Amazon Reviews 2023 benchmark.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetched here so the header and footer share one request. A dead model
  // service must still render a usable shell: the header says so in its status
  // band and the pages below report it themselves.
  let categories: Category[] = []
  let stats = { products: 0, users: 0, alpha: 0, ok: false }
  try {
    const [cats, health] = await Promise.all([getCategories(), getHealth()])
    categories = cats
    stats = {
      products: health.catalog ?? 0,
      users: health.users ?? 0,
      alpha: health.alpha ?? 0,
      ok: health.status === 'ok',
    }
  } catch {
    // Handled by the status band rather than by failing the render.
  }

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <SiteHeader categories={categories} stats={stats} />
          <main className="flex-1">{children}</main>
          <SiteFooter categories={categories} />
        </Providers>
      </body>
    </html>
  )
}
