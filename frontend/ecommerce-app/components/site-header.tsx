import Link from 'next/link'
import type { Category } from '@/lib/catalog-types'
import { formatCount } from '@/lib/format'
import { CartLink } from '@/components/cart-link'
import { SearchField } from '@/components/search-field'

/**
 * The header, in three bands.
 *
 * The top band carries the real state of the system: how many products are
 * loaded, how many shoppers the model was fitted on, and the blend weight it
 * is serving at. A storefront strip normally holds a shipping promise, but
 * this catalogue does not ship anything, so an invented "free delivery over
 * $50" would be the first lie on the page. The numbers are true and they tell
 * a reader what they are actually looking at.
 *
 * The third band is the category index. Seven of the previous build's dead
 * links pointed at category pages that did not exist; these point at real
 * buckets with real counts.
 */
export function SiteHeader({
  categories,
  stats,
}: {
  categories: Category[]
  stats: { products?: number; users?: number; alpha?: number; ok: boolean }
}) {
  const top = categories.slice(0, 6)

  return (
    <header className="sticky top-0 z-40 border-b border-rule-heavy bg-paper">
      {/* Band 1 — system state */}
      <div className="bg-ink text-paper">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5">
          <span className="label text-paper/60">
            {formatCount(stats.products ?? 0)} products
          </span>
          <span className="label text-paper/60">
            {formatCount(stats.users ?? 0)} modelled shoppers
          </span>
          <span className="label text-paper/60">
            hybrid alpha {(stats.alpha ?? 0).toFixed(2)}
          </span>
          <span className="label ml-auto flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 ${stats.ok ? 'bg-emerald-400' : 'bg-signal'}`}
              aria-hidden
            />
            <span className="text-paper/60">
              model service {stats.ok ? 'online' : 'unreachable'}
            </span>
          </span>
        </div>
      </div>

      {/* Band 2 — wordmark, search, cart */}
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="inline-block h-3 w-3 bg-signal" aria-hidden />
          <span className="font-mono text-[15px] font-semibold tracking-[0.14em]">
            ELECTROHUB
          </span>
        </Link>

        <div className="hidden min-w-0 flex-1 md:block">
          <SearchField />
        </div>

        <nav className="ml-auto flex shrink-0 items-center gap-4" aria-label="Main">
          <Link href="/catalog" className="label hover:text-signal">
            Catalogue
          </Link>
          <Link href="/recommendations" className="label hover:text-signal">
            Recommendations
          </Link>
          <CartLink />
        </nav>
      </div>

      {/* Band 2b — search on narrow screens, where it needs the full width */}
      <div className="border-t border-rule px-4 py-2 md:hidden">
        <SearchField />
      </div>

      {/* Band 3 — category index */}
      <div className="border-t border-rule bg-paper-sunk">
        <div className="mx-auto flex max-w-[1400px] items-center gap-x-5 gap-y-1 overflow-x-auto px-4 py-1.5">
          {top.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="label whitespace-nowrap hover:text-signal"
            >
              {c.name}{' '}
              <span className="tnum text-ink-3/70">{formatCount(c.count)}</span>
            </Link>
          ))}
          <Link
            href="/catalog"
            className="label ml-auto whitespace-nowrap text-signal"
          >
            All {categories.length} categories →
          </Link>
        </div>
      </div>
    </header>
  )
}
