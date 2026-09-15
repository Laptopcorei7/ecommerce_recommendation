import Link from 'next/link'
import type { Category } from '@/lib/catalog-types'
import { formatCount } from '@/lib/format'
import { CartLink } from '@/components/cart-link'
import { SearchField } from '@/components/search-field'

/**
 * The header: a yellow strip and a white bar.
 *
 * On a merch store the yellow strip holds a shipping promise or a drop. This
 * catalogue ships nothing, so an invented "free delivery over $50" would be
 * the first lie on the page. The strip carries the real state of the system
 * instead: products loaded, shoppers the model was fitted on, the blend weight
 * it is serving at, and whether the model service is up.
 */
export function SiteHeader({
  categories,
  stats,
}: {
  categories: Category[]
  stats: { products?: number; users?: number; alpha?: number; ok: boolean }
}) {
  return (
    <header className="sticky top-0 z-40 bg-bg shadow-[0_1px_0_var(--tile-2)]">
      <div className="bg-volt">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-5 gap-y-0.5 px-4 py-2 text-[12.5px] font-semibold">
          <span className="tnum">{formatCount(stats.products ?? 0)} products</span>
          <span className="tnum">{formatCount(stats.users ?? 0)} modelled shoppers</span>
          <span className="tnum hidden sm:inline">
            {categories.length} categories, blend alpha {(stats.alpha ?? 0).toFixed(2)}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-2 w-2 rounded-full ${stats.ok ? 'bg-fg' : 'bg-alert'}`}
              aria-hidden
            />
            Model service {stats.ok ? 'online' : 'unreachable'}
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3.5">
        <Link href="/" className="display shrink-0 text-[22px] sm:text-[26px]">
          ElectroHub
        </Link>

        <nav
          className="hidden items-center gap-6 text-[13px] font-semibold uppercase tracking-[0.06em] lg:flex"
          aria-label="Main"
        >
          <Link href="/catalog" className="hover:underline hover:decoration-2 hover:underline-offset-4">
            Catalogue
          </Link>
          <Link
            href="/recommendations"
            className="hover:underline hover:decoration-2 hover:underline-offset-4"
          >
            Recommendations
          </Link>
        </nav>

        <div className="ml-auto hidden w-full max-w-[420px] md:block">
          <SearchField />
        </div>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <Link href="/catalog" className="text-[13px] font-semibold uppercase lg:hidden">
            Shop
          </Link>
          <CartLink />
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchField />
      </div>
    </header>
  )
}
