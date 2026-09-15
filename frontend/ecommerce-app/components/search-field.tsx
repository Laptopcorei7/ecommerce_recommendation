'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Product } from '@/lib/catalog-types'
import { formatCount, shortTitle } from '@/lib/format'

/**
 * Search over 62,222 titles, with suggestions.
 *
 * Enter goes to /catalog, which renders the full result set on the server.
 * The dropdown is a preview of that, not a replacement for it, so it shows six
 * matches and the true total and then gets out of the way.
 *
 * Requests are debounced and the previous one is aborted, so typing "wireless
 * headphones" issues one request rather than nineteen, and a slow early
 * response can never overwrite a fast later one.
 */
export function SearchField({ initial = '' }: { initial?: string }) {
  const router = useRouter()
  const [q, setQ] = useState(initial)
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setItems([])
      setTotal(0)
      return
    }
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const body = (await res.json()) as { total: number; items: Product[] }
        setItems(body.items ?? [])
        setTotal(body.total ?? 0)
        setActive(-1)
      } catch {
        // An aborted request is the normal case here, not a failure.
      }
    }, 180)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [q])

  // Clicking anywhere else closes the dropdown.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const submit = (value: string) => {
    setOpen(false)
    router.push(`/catalog?q=${encodeURIComponent(value.trim())}`)
  }

  const showing = open && q.trim().length >= 2

  return (
    <div ref={box} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (q.trim()) submit(q)
        }}
      >
        <div className="flex">
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') return setOpen(false)
              if (!showing || items.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => (i + 1) % items.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
              } else if (e.key === 'Enter' && active >= 0) {
                e.preventDefault()
                setOpen(false)
                router.push(`/product/${items[active].id}`)
              }
            }}
            placeholder="Search 62,222 products by name or brand"
            aria-label="Search the catalogue"
            aria-expanded={showing}
            aria-controls={listId}
            className="field border-r-0"
          />
          <button type="submit" className="btn shrink-0" aria-label="Search">
            Find
          </button>
        </div>
      </form>

      {showing && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-full z-50 border border-ink bg-surface"
        >
          {items.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-ink-3">
              Nothing matches “{q.trim()}”.
            </p>
          ) : (
            <>
              {items.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    setOpen(false)
                    router.push(`/product/${p.id}`)
                  }}
                  className={`flex w-full items-center gap-2 border-b border-rule px-3 py-2 text-left ${
                    i === active ? 'bg-paper-sunk' : ''
                  }`}
                >
                  <span className="line-clamp-1 flex-1 text-[12.5px]">
                    {shortTitle(p.title, 72)}
                  </span>
                  <span className="font-mono tnum shrink-0 text-[10px] text-ink-3">
                    {p.id}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => submit(q)}
                className="label block w-full px-3 py-2 text-left hover:text-signal"
              >
                See all {formatCount(total)} matches →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
