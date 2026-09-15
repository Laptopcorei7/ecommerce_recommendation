import Link from 'next/link'
import { getCategories, getHealth, getProducts, getSampleUsers } from '@/lib/api'
import { formatCount, shortTitle } from '@/lib/format'
import { ProductImage } from '@/components/product-bits'
import { ProductCard } from '@/components/product-list'
import { RecPanel } from '@/components/rec-panel'

/**
 * The front page, laid out like a merch drop.
 *
 * A drop page leads with one big product and a heading, then a black band of
 * round category chips, then product tiles. The layout is borrowed; the
 * content is not. The lead product is the most-rated record in the catalogue,
 * the chips carry real bucket counts, and every product below is a real
 * record. A lifestyle photo would have to be invented, and so would a
 * "Trending today" caption, so neither is here.
 */

export const revalidate = 300

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

export default async function Home() {
  const [categories, popular, users, health] = await Promise.all([
    getCategories().catch(() => []),
    getProducts({ sort: 'popular', perPage: 7 }).catch(() => null),
    // The same 40 as the recommendations page, so "Shopper 3" is the same
    // person on both.
    getSampleUsers(40).then((r) => r.users).catch(() => []),
    getHealth().catch(() => null),
  ])

  if (!categories.length && !popular) {
    return <ServiceDown />
  }

  const [lead, ...rest] = popular?.items ?? []

  return (
    <>
      {/* ---- lead ---------------------------------------------------------- */}
      <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:py-16">
        <div>
          <p className="pill mb-5">Amazon Reviews 2023, Electronics</p>
          <h1 className="display text-[40px] sm:text-[56px] xl:text-[76px]">
            Every product the model was trained to rank.
          </h1>
          <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-fg-2">
            {formatCount(health?.catalog ?? 0)} products with prices, ratings and
            photographs as they appear in the source. Recommendations come from a
            hybrid model fitted on {formatCount(health?.users ?? 0)} shoppers, and
            every one shows the score that put it where it is.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/catalog" className="btn">
              Shop the catalogue
            </Link>
            <Link href="/recommendations" className="btn btn-volt">
              Run the recommender
            </Link>
          </div>
        </div>

        {lead && (
          <Link href={`/product/${lead.id}`} className="group block">
            <div className="aspect-square">
              <ProductImage
                src={lead.image}
                alt={lead.title}
                id={lead.id}
                sizes="(max-width: 768px) 100vw, 620px"
                priority
              />
            </div>
            <p className="mt-3 flex items-baseline justify-between gap-4">
              <span className="min-w-0 text-[14px] group-hover:underline">
                <span className="font-semibold">Most rated: </span>
                {shortTitle(lead.title, 80)}
              </span>
              <span className="meta tnum shrink-0">
                {formatCount(lead.rating_number)} ratings
              </span>
            </p>
          </Link>
        )}
      </section>

      {/* ---- category chips -------------------------------------------------- */}
      <section className="bg-band text-bg" aria-labelledby="categories-heading">
        <div className="mx-auto max-w-[1400px] px-4 py-10">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="categories-heading" className="display text-[26px] sm:text-[36px]">
              Shop by category
            </h2>
            <Link href="/catalog" className="text-[13px] font-semibold uppercase hover:text-volt">
              All {categories.length} categories
            </Link>
          </div>
          {/* The number in each chip is the bucket's product count. The
              catalogue is 43% one category, and the chips show that. */}
          <ul className="-mx-4 flex gap-6 overflow-x-auto px-4 pb-2">
            {categories.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link href={`/categories/${c.slug}`} className="group flex w-[104px] flex-col items-center">
                  <span className="display tnum flex h-[92px] w-[92px] items-center justify-center rounded-full bg-bg text-[19px] text-fg transition-colors group-hover:bg-volt">
                    {compact.format(c.count)}
                  </span>
                  <span className="mt-3 text-center text-[13px] font-semibold leading-tight underline decoration-bg/30 decoration-2 underline-offset-4 group-hover:decoration-volt">
                    {c.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] px-4">
        {/* ---- recommendations --------------------------------------------- */}
        <section className="py-16">
          <div className="section-head">
            <h2 className="display">Top picks for a shopper</h2>
            <p>
              What the model suggests for one real shopper from the dataset, based
              on what they rated.
            </p>
          </div>
          <RecPanel users={users} topN={5} />
        </section>

        {/* ---- most rated --------------------------------------------------- */}
        <section className="pb-4">
          <div className="section-head">
            <h2 className="display">Most rated</h2>
            <p className="mx-auto max-w-[70ch]">
              Ordered by number of ratings, the closest thing this dataset has to a
              sales figure. This is also the popularity baseline the hybrid model
              has to beat, and it beats it by 0.0183 to 0.0163 on hit-rate@10.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3">
            {rest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/catalog?sort=popular" className="btn btn-volt">
              See all most rated
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}

function ServiceDown() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-20">
      <p className="pill mb-4 bg-alert-tint text-alert">503</p>
      <h1 className="display text-[36px] sm:text-[52px]">The model service is not running.</h1>
      <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-fg-2">
        This storefront has no catalogue of its own. Products, categories and
        recommendations all come from the model service, so nothing renders
        until it is up.
      </p>
      <pre className="mt-6 overflow-x-auto bg-band px-4 py-3 font-mono text-[13px] text-bg">
        python -m uvicorn ml_api.main:app --port 8001
      </pre>
    </div>
  )
}
