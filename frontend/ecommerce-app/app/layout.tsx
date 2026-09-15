import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { getCategories, getHealth, type Category } from '@/lib/api'

/**
 * Archivo, loaded as one variable file with its width axis.
 *
 * The width axis is what gives the site two voices from one family: 125 for
 * the display headings (`.display` in globals.css) and the default 100 for
 * everything a reader has to actually read.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
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
  } catch (err) {
    // Handled by the status strip rather than by failing the render.
    console.error('Layout could not reach the model service:', err)
  }

  return (
    <html lang="en" className={archivo.variable}>
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
