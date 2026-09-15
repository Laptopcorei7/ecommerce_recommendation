'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Product, Recommendations, Shopper } from '@/lib/catalog-types'
import { formatCount, formatScore, shortTitle, shortUserId } from '@/lib/format'
import { useStore } from '@/app/providers'
import { ProductImage } from '@/components/product-bits'
import { ProductRow } from '@/components/product-list'

/**
 * The recommender, explained as you use it.
 *
 * A reader who has never seen a recommender needs three things in order: who
 * the picks are for, what the model knows about them, and what it suggests.
 * The page shows exactly that, as numbered steps. Shoppers are labelled by
 * their real training history ("12 ratings, mostly Headphones") instead of
 * the 28-character reviewer id, and no names or personas are invented.
 *
 * With controls on, alpha is live. The API reads it per request, so dragging
 * the slider re-ranks 62,222 items for the same shopper without a retrain.
 */

function shopperLabel(shopper: Shopper, index: number) {
  const mostly = shopper.top_category ? `, mostly ${shopper.top_category}` : ''
  return `Shopper ${index + 1}: ${formatCount(shopper.rated)} ratings${mostly}`
}

export function RecPanel({
  users,
  topN = 10,
  controls = false,
  defaultAlpha = 0.9,
}: {
  users: Shopper[]
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

  // A shopper saved from an earlier visit may not be in this sample, in which
  // case the first sampled shopper stands in.
  const saved = users.findIndex((u) => u.id === userId)
  const index = saved >= 0 ? saved : 0
  const active = users[index] ?? null
  const activeId = active?.id ?? null

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
      } catch (err) {
        console.error('Recommendation request failed:', err)
        if (mine === seq.current) setError('Could not reach the model service.')
      } finally {
        if (mine === seq.current) setLoading(false)
      }
    },
    [topN],
  )

  useEffect(() => {
    if (!ready || !activeId) return
    load(activeId, alpha)
  }, [ready, activeId, alpha, load])

  if (!active) {
    return (
      <p className="bg-tile px-5 py-6 text-[14px] text-fg-2">
        The model service is unreachable, so there are no shoppers to recommend
        for. Start it with{' '}
        <code className="font-mono text-[13px] text-fg">
          python -m uvicorn ml_api.main:app --port 8001
        </code>
        .
      </p>
    )
  }

  const items = data?.items ?? []
  const history = data?.history ?? []
  // One scale for every bar in the list, set by the strongest score.
  const scoreMax = items.length ? Math.max(...items.map((i) => i.score ?? 0)) : 1
  const label = shopperLabel(active, index)

  const results = error ? (
    <p className="bg-alert-tint px-5 py-4 text-[14px] text-alert">{error}</p>
  ) : items.length === 0 && loading ? (
    <RecSkeleton rows={Math.min(topN, 5)} />
  ) : (
    <div className={`space-y-2 transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
      {items.map((p: Product, i) => (
        <ProductRow key={p.id} product={p} rank={i + 1} scoreMax={scoreMax} />
      ))}
    </div>
  )

  /* ---- front page: one shopper, compact ---------------------------------- */
  if (!controls) {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3 bg-band px-5 py-4 text-bg">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-volt">Picks for</p>
            <p className="text-[16px] font-bold">{label}</p>
          </div>
          {history.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12.5px] text-bg/70">They rated</span>
              <ul className="flex gap-1.5">
                {history.slice(0, 5).map((p) => (
                  <li key={p.id} className="h-11 w-11 overflow-hidden bg-bg" title={p.title}>
                    <ProductImage src={p.image} alt={p.title} id={p.id} sizes="44px" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {results}
        <div className="mt-8 text-center">
          <Link href="/recommendations" className="btn">
            Try other shoppers
          </Link>
        </div>
      </div>
    )
  }

  /* ---- recommendations page: the three steps ----------------------------- */
  return (
    <div className="space-y-12">
      <Step n={1} title="Pick a shopper">
        <div className="bg-band px-5 py-5 text-bg">
          {/* A native select cannot wrap, so on a phone the label is cut off.
              The full label is repeated above it where that happens. */}
          <p className="mb-3 text-[17px] font-bold leading-snug sm:hidden">{label}</p>
          <select
            value={active.id}
            onChange={(e) => setUserId(e.target.value)}
            className="field w-full max-w-[560px] border-bg/30 bg-band text-[16px] font-semibold text-bg focus:border-volt"
            aria-label="Choose a shopper"
          >
            {users.map((u, i) => (
              <option key={u.id} value={u.id}>
                {shopperLabel(u, i)}
              </option>
            ))}
          </select>
          <p className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-bg/70">
            Each shopper is a real, anonymised reviewer from the Amazon Reviews
            2023 dataset. They are numbered here because the dataset identifies
            them only by a code; this one is{' '}
            <span className="tnum">{shortUserId(active.id, 6, 4)}</span>.
          </p>
        </div>
      </Step>

      <Step n={2} title="See what they rated">
        <p className="mb-5 max-w-[75ch] text-[15px] leading-relaxed text-fg-2">
          This is everything the model knows about Shopper {index + 1}: the{' '}
          <span className="tnum font-semibold text-fg">
            {data ? formatCount(data.rated) : formatCount(active.rated)}
          </span>{' '}
          products they rated. Their highest-rated ones are below. None of these
          can appear in their picks.
        </p>
        {history.length === 0 && loading ? (
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-tile" />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {history.map((p) => (
              <li key={p.id}>
                <Link href={`/product/${p.id}`} className="group block">
                  <div className="aspect-square">
                    <ProductImage src={p.image} alt={p.title} id={p.id} sizes="220px" />
                  </div>
                  {p.user_rating != null && (
                    <p className="pill tnum mt-2 bg-volt">Gave it {p.user_rating.toFixed(0)} of 5</p>
                  )}
                  <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug group-hover:underline">
                    {shortTitle(p.title, 90)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step n={3} title="See what the model suggests">
        <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="max-w-[70ch] space-y-3 text-[15px] leading-relaxed text-fg-2">
            <p>
              The model ranked all 62,222 products for this shopper and these are
              the top {topN}. The bar under each pick shows where its score came
              from:
            </p>
            <p className="flex flex-wrap gap-x-5 gap-y-1 text-fg">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-collab" aria-hidden />
                Shoppers with similar taste liked it
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-content" aria-hidden />
                It is described like what they rated
              </span>
            </p>
          </div>

          <div className="bg-tile p-5">
            <p className="text-[14px] font-bold">Try it: change what the model listens to</p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="mt-3 w-full accent-[var(--fg)]"
              aria-label="Weight given to similar shoppers versus similar products"
              aria-valuetext={`${Math.round(alpha * 100)}% similar shoppers`}
            />
            <div className="mt-1 flex justify-between text-[12.5px] font-semibold">
              <span>Similar products</span>
              <span className="tnum">{Math.round(alpha * 100)}% shoppers</span>
              <span>Similar shoppers</span>
            </div>
            <p className="meta mt-3 leading-relaxed">
              Technical name: blend alpha, now {alpha.toFixed(2)}. At 0.90 the
              model scores 0.0183 hit-rate@10; at 0 it scores 0.0023. The table
              below has the full comparison.
            </p>
          </div>
        </div>
        {results}
        {data && (
          <p className="meta mt-4 max-w-[80ch]">
            Scores are blended z-scores, not probabilities, so only their order
            and spacing carry meaning. Top score {formatScore(scoreMax)}.
          </p>
        )}
      </Step>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 flex items-center gap-4">
        <span className="display tnum flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-volt text-[22px]">
          {n}
        </span>
        <span className="display text-[24px] sm:text-[32px]">{title}</span>
      </h2>
      {children}
    </section>
  )
}

function RecSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 bg-tile-soft p-4">
          <div className="h-[104px] w-[104px] shrink-0 bg-tile" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2.5 w-24 rounded-full bg-tile" />
            <div className="h-3.5 w-3/4 rounded-full bg-tile" />
            <div className="h-3.5 w-1/2 rounded-full bg-tile" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading recommendations</span>
    </div>
  )
}
