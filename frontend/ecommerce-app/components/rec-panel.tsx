'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Product, Recommendations } from '@/lib/catalog-types'
import { formatScore, shortUserId } from '@/lib/format'
import { useStore } from '@/app/providers'
import { ProductRow } from '@/components/product-list'

/**
 * The recommender, shown as what it is.
 *
 * Every row carries its rank, its blended score, and the two weighted halves
 * that produced it, because the interesting claim this project makes is about
 * ranking quality and a grid of product photos cannot support or refute it.
 *
 * With controls on, alpha is live. The API reads it per request rather than
 * baking it into the model file, so dragging the slider re-ranks 62,222 items
 * against the same user without a retrain. Pushing it to 0 leaves only the
 * content half, and the ordering visibly collapses; that is the finding, and
 * it is more convincing to let a reader produce it than to assert it.
 */
export function RecPanel({
  users,
  topN = 10,
  controls = false,
  defaultAlpha = 0.9,
}: {
  users: string[]
  topN?: number
  controls?: boolean
  defaultAlpha?: number
}) {
  const { userId, setUserId, ready } = useStore()
  const [alpha, setAlpha] = useState(defaultAlpha)
  const [data, setData] = useState<Recommendations | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)

  // Falls back to the first sampled id so the panel has something to show
  // before anyone has chosen a shopper.
  const active = userId ?? users[0] ?? null

  const load = useCallback(
    async (uid: string, a: number) => {
      const mine = ++seq.current
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/recommend?user_id=${encodeURIComponent(uid)}&top_n=${topN}&alpha=${a}`,
        )
        const body = await res.json()
        // A slower earlier request must not overwrite a newer result. Dragging
        // the alpha slider fires several of these in a row.
        if (mine !== seq.current) return
        if (!res.ok) {
          setError(body?.detail ?? 'Could not load recommendations.')
          setData(null)
        } else {
          setData(body as Recommendations)
        }
      } catch {
        if (mine === seq.current) setError('Could not reach the model service.')
      } finally {
        if (mine === seq.current) setLoading(false)
      }
    },
    [topN],
  )

  useEffect(() => {
    if (!ready || !active) return
    load(active, alpha)
  }, [ready, active, alpha, load])

  if (!active) {
    return (
      <p className="border border-rule bg-paper-sunk px-4 py-6 text-[13px] text-ink-2">
        The model service is unreachable, so there are no shopper ids to
        recommend for. Start it with{' '}
        <code className="font-mono text-[12px]">
          python -m uvicorn ml_api.main:app --port 8001
        </code>
        .
      </p>
    )
  }

  const items = data?.items ?? []
  // One scale for every bar in the list, set by the strongest score.
  const scoreMax = items.length ? Math.max(...items.map((i) => i.score ?? 0)) : 1

  return (
    <div>
      {/* ---- controls ---- */}
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3 border border-rule bg-paper-sunk px-4 py-3">
        <div>
          <div className="label mb-1.5">Shopper</div>
          {controls ? (
            <select
              value={active}
              onChange={(e) => setUserId(e.target.value)}
              className="field font-mono text-[12px]"
              aria-label="Choose a shopper from the training set"
            >
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          ) : (
            <div className="font-mono text-[12px]">{shortUserId(active, 10, 6)}</div>
          )}
        </div>

        {controls && (
          <div className="min-w-[220px]">
            <div className="label mb-1.5 flex justify-between gap-3">
              <span>Blend alpha</span>
              <span className="tnum text-ink">{alpha.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="w-full accent-[var(--signal)]"
              aria-label="Blend weight between the collaborative and content halves"
            />
            <div className="label mt-1 flex justify-between">
              <span>content only</span>
              <span>collaborative only</span>
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-4">
          <span className="label flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 bg-collab" aria-hidden />
            collaborative
          </span>
          <span className="label flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 bg-content" aria-hidden />
            content
          </span>
        </div>
      </div>

      {/* ---- results ---- */}
      {error ? (
        <p className="border border-signal bg-signal-tint px-4 py-3 text-[13px]">
          {error}
        </p>
      ) : items.length === 0 && loading ? (
        <RecSkeleton rows={Math.min(topN, 5)} />
      ) : (
        <div
          className={`border-t border-rule transition-opacity ${
            loading ? 'opacity-50' : 'opacity-100'
          }`}
        >
          {items.map((p: Product, i) => (
            <ProductRow key={p.id} product={p} rank={i + 1} scoreMax={scoreMax} />
          ))}
        </div>
      )}

      {!controls && (
        <Link
          href="/recommendations"
          className="label mt-3 inline-block hover:text-signal"
        >
          Change shopper and tune the blend →
        </Link>
      )}

      {controls && data && (
        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-2">
          Ranked from 62,222 items, excluding the{' '}
          <span className="font-mono">{shortUserId(data.user_id, 8, 4)}</span>{' '}
          history the model trained on. Scores are blended z-scores, not
          probabilities, so only their order and their spacing carry meaning.
          Top score {formatScore(scoreMax)}.
        </p>
      )}
    </div>
  )
}

function RecSkeleton({ rows }: { rows: number }) {
  return (
    <div className="border-t border-rule">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-rule py-4">
          <div className="h-[88px] w-[88px] shrink-0 bg-paper-sunk" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2 w-24 bg-paper-sunk" />
            <div className="h-3 w-3/4 bg-paper-sunk" />
            <div className="h-3 w-1/2 bg-paper-sunk" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading recommendations</span>
    </div>
  )
}
