import Link from 'next/link'
import { getCategories, getHealth, getProducts, getSampleUsers } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { ProductCard } from '@/components/product-list'
import { RecPanel } from '@/components/rec-panel'

/**
 * The front page is the category index.
 *
 * A supply catalogue opens on its contents, not on a photograph of a smiling
 * person holding a phone. What was here before was a purple-to-blue gradient,
 * a 6xl headline, two buttons and an emoji standing in for the hero image, and
 * below it six invented products with invented prices.
 *
 * Everything on this page is now a real record or a real count.
 */

export const revalidate = 300

export default async function Home() {
  const [categories, popular, users, health] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ sort: 'popular', perPage: 6 }).catch(() => null),
    getSampleUsers(24).then((r) => r.user_ids).catch(() => []),
    getHealth().catch(() => null),
  ])

  if (!categories.length && !popular) {
    return <ServiceDown />
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      {/* ---- front matter ------------------------------------------------ */}
      <section className="grid gap-8 border-b-2 border-rule-heavy py-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="label mb-3">Electronics catalogue, edition 2023</p>
          <h1 className="max-w-[18ch] text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] md:text-[44px]">
            Every product the model was trained to rank.
          </h1>
          <p className="mt-4 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">
            {formatCount(health?.catalog ?? 0)} products from the Amazon Reviews
            2023 Electronics benchmark, with prices, ratings and photographs as
            they appear in the source. Recommendations come from a hybrid model
            fitted on {formatCount(health?.users ?? 0)} shoppers, and every one
            of them shows the score that put it where it is.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn">
              Browse the catalogue
            </Link>
            <Link href="/recommendations" className="btn btn-line">
              Run the recommender
            </Link>
          </div>
        </div>

        {/* A specification block, the way a catalogue states its own extent. */}
        <dl className="min-w-[240px] self-start border border-rule bg-paper-sunk">
          {[
            ['Products', formatCount(health?.catalog ?? 0)],
            ['Categories', formatCount(categories.length)],
            ['Shoppers', formatCount(health?.users ?? 0)],
            ['Interactions', '1,179,677'],
            ['Latent factors', formatCount(health?.factors ?? 0)],
            ['Blend alpha', (health?.alpha ?? 0).toFixed(2)],
          ].map(([term, value]) => (
            <div
              key={term}
              className="flex items-baseline justify-between gap-6 border-b border-rule px-3 py-2 last:border-b-0"
            >
              <dt className="label">{term}</dt>
              <dd className="font-mono tnum text-[13px]">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---- category index ---------------------------------------------- */}
      <section className="py-10">
        <div className="section-head">
          <h2>Categories</h2>
          <Link href="/catalog" className="label hover:text-signal">
            Browse everything →
          </Link>
        </div>

        {/* Counts are right-aligned in a mono column so the distribution is
            readable at a glance: this catalogue is 43% one category. */}
        <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/categories/${c.slug}`}
                className="group flex items-baseline gap-3 border-b border-rule py-2.5"
              >
                <span className="text-[13.5px] group-hover:text-signal">
                  {c.name}
                </span>
                <span className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-rule-2" />
                <span className="font-mono tnum text-[12px] text-ink-3">
                  {formatCount(c.count)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- recommendations --------------------------------------------- */}
      <section className="py-10">
        <div className="section-head">
          <h2>Recommended for a shopper</h2>
          <span className="label">hybrid ranking, live</span>
        </div>
        <RecPanel users={users} topN={5} />
      </section>

      {/* ---- most rated --------------------------------------------------- */}
      <section className="py-10">
        <div className="section-head">
          <h2>Most rated in the catalogue</h2>
          <Link href="/catalog?sort=popular" className="label hover:text-signal">
            See all →
          </Link>
        </div>
        <p className="mb-5 max-w-[70ch] text-[13px] text-ink-2">
          Ordered by number of ratings, which is the closest thing this dataset
          has to a sales figure. This is also the popularity baseline the hybrid
          model has to beat, and it beats it by 0.0183 to 0.0163 on hit-rate@10.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {popular?.items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
    </div>
  )
}

function ServiceDown() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-20">
      <p className="label mb-3">503</p>
      <h1 className="text-[28px] font-semibold">The model service is not running.</h1>
      <p className="mt-4 max-w-[60ch] text-[14px] leading-relaxed text-ink-2">
        This storefront has no catalogue of its own. Products, categories and
        recommendations all come from the model service, so nothing renders
        until it is up.
      </p>
      <pre className="mt-6 overflow-x-auto border border-rule bg-surface px-4 py-3 font-mono text-[12.5px]">
        python -m uvicorn ml_api.main:app --port 8001
      </pre>
    </div>
  )
}
