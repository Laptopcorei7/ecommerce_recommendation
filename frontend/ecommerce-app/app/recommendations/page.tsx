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
      .then((r) => r.user_ids)
      .catch(() => []),
    getHealth().catch(() => null),
  ])

  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="border-b-2 border-rule-heavy pb-5 pt-8">
        <p className="label mb-2">Hybrid recommender</p>
        <h1 className="max-w-[24ch] text-[30px] font-semibold leading-tight">
          Ranked for one shopper, out of {formatCount(health?.catalog ?? 0)}.
        </h1>
        <p className="mt-3 max-w-[80ch] text-[14px] leading-relaxed text-ink-2">
          Pick any of the shoppers the model was fitted on and it ranks the
          whole catalogue for them, minus what they already rated. The blend
          weight is read on every request rather than baked into the model file,
          so moving it re-ranks live.
        </p>
      </div>

      <section className="py-8">
        <RecPanel
          users={users}
          topN={20}
          controls
          defaultAlpha={health?.alpha ?? 0.9}
        />
      </section>

      {/* ---- how it works ---- */}
      <section className="grid gap-10 border-t border-rule py-10 lg:grid-cols-2">
        <div>
          <div className="section-head">
            <h2>What the two halves are</h2>
          </div>
          <dl className="space-y-4 text-[13px] leading-relaxed">
            <div>
              <dt className="label mb-1 text-collab">Collaborative</dt>
              <dd className="max-w-[62ch] text-ink-2">
                Implicit-feedback ALS over {formatCount(health?.factors ?? 0)}{' '}
                latent factors, fitted on observed interactions only. An earlier
                version used truncated SVD, which treats every unobserved cell as
                a zero rating; at 0.0159% density that is 99.98% of the objective,
                and the personalized term was crushed to a std of 0.0017 against
                an item bias of 0.2281. It ranked no better than random.
              </dd>
            </div>
            <div>
              <dt className="label mb-1 text-content">Content</dt>
              <dd className="max-w-[62ch] text-ink-2">
                A similarity-weighted average of the ratings this shopper gave to
                items whose title, brand and category text resemble the
                candidate. It contributes almost nothing to ranking on this
                benchmark, which the slider will show you directly.
              </dd>
            </div>
            <div>
              <dt className="label mb-1">The blend</dt>
              <dd className="max-w-[62ch] text-ink-2">
                Both halves are standardized before they are combined. Without
                that step a collaborative term spanning 4.0 was being added to a
                content term spanning 0.028, so the content half could not move
                the ranking at any weight.
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <div className="section-head">
            <h2>Hit-rate@10 against baselines</h2>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-rule-heavy">
                <th className="label py-2 text-left font-normal">Model</th>
                <th className="label py-2 text-right font-normal">hit-rate@10</th>
                <th className="label py-2 text-right font-normal">Note</th>
              </tr>
            </thead>
            <tbody>
              {EVALUATION.map((row) => (
                <tr key={row.model} className="border-b border-rule">
                  <td className="py-2">{row.model}</td>
                  <td className="py-2 text-right font-mono tnum">{row.hit}</td>
                  <td className="label py-2 text-right">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-2">
            The margin over popularity is real but small, and the margin over
            pure collaborative is 0.0003 on 3,000 users, which is inside noise.
            The content half adds nothing measurable to ranking on a 5-core
            benchmark. Reported here rather than left out, because a
            recommender evaluated without a popularity baseline is not
            evaluated at all.
          </p>
          <p className="mt-3 text-[12.5px] text-ink-2">
            RMSE 1.2911 · NDCG@10 0.0101 · Recall@10 0.0188
          </p>
        </div>
      </section>
    </div>
  )
}
