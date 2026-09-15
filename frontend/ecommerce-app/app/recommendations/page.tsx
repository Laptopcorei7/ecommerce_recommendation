import type { Metadata } from 'next'
import { getHealth, getSampleUsers } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { RecPanel } from '@/components/rec-panel'

/**
 * The recommender, with its controls and its numbers.
 *
 * This is the page the rest of the project exists for, so it does not hide
 * behind a "Recommended for you" carousel. You pick a shopper, you move the
 * blend weight, and you watch 62,222 items re-rank. The evaluation table below
 * reports what the model scores against its baselines, including the ones it
 * barely beats.
 */

export const metadata: Metadata = {
  title: 'Recommendations',
  description:
    'Hybrid recommendations with live blend weight, scored against popularity and random baselines.',
}

/** From ml_api/pipeline/evaluate.py, 3,000 held-out users, leave-last-out. */
const EVALUATION = [
  { model: 'Hybrid, alpha 0.90', hit: '0.0183', note: 'served here' },
  { model: 'Pure collaborative (ALS)', hit: '0.0180', note: 'alpha 1.0' },
  { model: 'Popularity', hit: '0.0163', note: 'baseline' },
  { model: 'Pure content', hit: '0.0023', note: 'alpha 0.0' },
  { model: 'Random', hit: '0.0000', note: 'baseline' },
]

export default async function RecommendationsPage() {
  const [users, health] = await Promise.all([
    getSampleUsers(40)
      .then((r) => r.users)
      .catch(() => []),
    getHealth().catch(() => null),
  ])

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="page-head">
        <p className="meta mb-3">Hybrid recommender</p>
        <h1 className="display max-w-[18ch]">How the recommender picks products</h1>
        <p className="mt-5 max-w-[75ch] text-[16px] leading-relaxed text-fg-2">
          A recommender looks at what a shopper has already rated and guesses
          what else they would want. This page lets you watch it do that for
          real shoppers: choose one, see what they rated, and see what the model
          picks for them out of{' '}
          <span className="tnum font-semibold text-fg">
            {formatCount(health?.catalog ?? 0)}
          </span>{' '}
          products.
        </p>
      </div>

      <section className="pb-8">
        <RecPanel
          users={users}
          topN={20}
          controls
          defaultAlpha={health?.alpha ?? 0.9}
        />
      </section>

      {/* ---- how it works ---- */}
      <section className="grid gap-12 py-12 lg:grid-cols-2">
        <div>
          <h2 className="display mb-6 text-[26px] sm:text-[32px]">How a score is made</h2>
          <dl className="space-y-5 text-[15px] leading-relaxed">
            <div>
              <dt className="mb-1 flex items-center gap-2 font-bold">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-collab" aria-hidden />
                Similar shoppers <span className="font-normal text-fg-3">(collaborative filtering)</span>
              </dt>
              <dd className="max-w-[62ch] text-fg-2">
                Implicit-feedback ALS over {formatCount(health?.factors ?? 0)}{' '}
                latent factors, fitted on observed interactions only. An earlier
                version used truncated SVD, which treats every unobserved cell as
                a zero rating; at 0.0159% density that is 99.98% of the objective,
                and the personalized term was crushed to a std of 0.0017 against
                an item bias of 0.2281. It ranked no better than random.
              </dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-2 font-bold">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-content" aria-hidden />
                Similar products <span className="font-normal text-fg-3">(content-based)</span>
              </dt>
              <dd className="max-w-[62ch] text-fg-2">
                A similarity-weighted average of the ratings this shopper gave to
                items whose title, brand and category text resemble the
                candidate. It contributes almost nothing to ranking on this
                benchmark, which the slider will show you directly.
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-bold">The blend</dt>
              <dd className="max-w-[62ch] text-fg-2">
                Both halves are standardized before they are combined. Without
                that step a collaborative term spanning 4.0 was being added to a
                content term spanning 0.028, so the content half could not move
                the ranking at any weight.
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className="display mb-6 text-[26px] sm:text-[32px]">Hit-rate@10 against baselines</h2>
          <table className="w-full text-[14.5px]">
            <thead>
              <tr className="bg-band text-bg">
                <th className="px-3 py-2.5 text-left text-[12.5px] font-bold uppercase">Model</th>
                <th className="px-3 py-2.5 text-right text-[12.5px] font-bold uppercase">Hit-rate@10</th>
                <th className="px-3 py-2.5 text-right text-[12.5px] font-bold uppercase">Note</th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION.map((row, i) => (
                <tr key={row.model} className={i === 0 ? 'bg-volt font-semibold' : 'even:bg-tile-soft'}>
                  <td className="px-3 py-2.5">{row.model}</td>
                  <td className="tnum px-3 py-2.5 text-right font-bold">{row.hit}</td>
                  <td className="px-3 py-2.5 text-right text-[13px]">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 max-w-[62ch] text-[14px] leading-relaxed text-fg-2">
            The margin over popularity is real but small, and the margin over
            pure collaborative is 0.0003 on 3,000 users, which is inside noise.
            The content half adds nothing measurable to ranking on a 5-core
            benchmark. Reported here rather than left out, because a
            recommender evaluated without a popularity baseline is not
            evaluated at all.
          </p>
          <p className="tnum mt-3 text-[14px] font-semibold">
            RMSE 1.2911 · NDCG@10 0.0101 · Recall@10 0.0188
          </p>
        </div>
      </section>
    </div>
  )
}
