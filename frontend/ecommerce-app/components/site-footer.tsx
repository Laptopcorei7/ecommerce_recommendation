import Link from 'next/link'
import type { Category } from '@/lib/catalog-types'
import { formatCount } from '@/lib/format'

/**
 * A colophon, not a sitemap.
 *
 * The previous footer had three columns of links (Customer Service, Company,
 * Legal) and eleven of them 404'd. Returns, Shipping, Track Order and Cookie
 * Policy do not exist because this catalogue does not sell anything, so the
 * honest fix is to stop claiming they do rather than to generate eleven stub
 * pages so the links resolve.
 *
 * What replaces them is what a reader actually needs: where the data came
 * from, what the model is, and the fact that nothing here ships.
 */
export function SiteFooter({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-16 border-t-2 border-rule-heavy bg-paper-sunk">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-3 w-3 bg-signal" aria-hidden />
            <span className="font-mono text-[14px] font-semibold tracking-[0.14em]">
              ELECTROHUB
            </span>
          </div>
          <p className="max-w-[46ch] text-[13px] leading-relaxed text-ink-2">
            A storefront over a hybrid recommender. Products, prices, ratings and
            images are real records from the Amazon Reviews 2023 Electronics
            benchmark, and the rankings come from a model fitted on 1,179,677 of
            its interactions.
          </p>
          <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-ink-3">
            Nothing here ships. There is no payment step and no account, which is
            why there are no shipping, returns or sign-in pages to link to.
          </p>
        </div>

        <nav aria-label="Categories">
          <h2 className="label mb-3 text-ink">Categories</h2>
          <ul className="space-y-1.5">
            {categories.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="flex justify-between gap-3 text-[12.5px] text-ink-2 hover:text-signal"
                >
                  <span>{c.name}</span>
                  <span className="font-mono tnum text-[11px] text-ink-3">
                    {formatCount(c.count)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="label mb-3 text-ink">Colophon</h2>
          <dl className="space-y-1.5 text-[12.5px]">
            {[
              ['Data', 'Amazon Reviews 2023, Electronics 5-core'],
              ['Ranking', 'Implicit ALS, 64 factors'],
              ['Rating', 'SVD on residual, TF-IDF content'],
              ['Blend', 'alpha 0.90, standardized halves'],
              ['Serving', 'FastAPI, Next.js App Router'],
            ].map(([term, value]) => (
              <div key={term} className="flex gap-2">
                <dt className="label w-[58px] shrink-0 pt-[3px]">{term}</dt>
                <dd className="text-ink-2">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-x-4 gap-y-1 px-4 py-3">
          <span className="label">Built as a recommender systems project</span>
          <Link href="/catalog" className="label ml-auto hover:text-signal">
            Catalogue
          </Link>
          <Link href="/recommendations" className="label hover:text-signal">
            Recommendations
          </Link>
        </div>
      </div>
    </footer>
  )
}
