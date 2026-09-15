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
    <footer className="mt-20 bg-band text-bg">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <p className="display mb-5 text-[34px] sm:text-[44px]">ElectroHub</p>
          <p className="max-w-[46ch] text-[14px] leading-relaxed text-bg/80">
            A storefront over a hybrid recommender. Products, prices, ratings and
            images are real records from the Amazon Reviews 2023 Electronics
            benchmark, and the rankings come from a model fitted on 1,179,677 of
            its interactions.
          </p>
          <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-bg/60">
            Nothing here ships. There is no payment step and no account, which is
            why there are no shipping, returns or sign-in pages to link to.
          </p>
        </div>

        <nav aria-label="Categories">
          <h2 className="display mb-4 text-[15px] text-volt">Categories</h2>
          <ul className="space-y-2">
            {categories.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  className="flex justify-between gap-3 text-[14px] hover:underline"
                >
                  <span>{c.name}</span>
                  <span className="tnum text-[12.5px] text-bg/60">{formatCount(c.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="display mb-4 text-[15px] text-volt">Colophon</h2>
          <dl className="space-y-2 text-[14px]">
            {[
              ['Data', 'Amazon Reviews 2023, Electronics 5-core'],
              ['Ranking', 'Implicit ALS, 64 factors'],
              ['Rating', 'SVD on residual, TF-IDF content'],
              ['Blend', 'alpha 0.90, standardized halves'],
              ['Serving', 'FastAPI, Next.js App Router'],
            ].map(([term, value]) => (
              <div key={term} className="flex gap-3">
                <dt className="w-[64px] shrink-0 font-semibold">{term}</dt>
                <dd className="text-bg/70">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-t border-bg/15">
        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-x-6 gap-y-2 px-4 py-4 text-[13px]">
          <span className="text-bg/60">Built as a recommender systems project</span>
          <Link href="/catalog" className="ml-auto font-semibold uppercase hover:text-volt">
            Catalogue
          </Link>
          <Link href="/recommendations" className="font-semibold uppercase hover:text-volt">
            Recommendations
          </Link>
        </div>
      </div>
    </footer>
  )
}
