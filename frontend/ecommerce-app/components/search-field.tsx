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
        <div className="flex items-center rounded-full bg-tile pl-4 pr-1 focus-within:shadow-[0_0_0_2px_var(--fg)]">
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
            className="w-full min-w-0 bg-transparent py-2 text-[14.5px] outline-none placeholder:text-fg-3"
          />
          <button
            type="submit"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-bg hover:bg-volt hover:text-fg"
            aria-label="Search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2.5" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </form>

      {showing && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden border-2 border-fg bg-bg"
        >
          {items.length === 0 ? (
            <p className="meta px-4 py-3">
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
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    i === active ? 'bg-tile' : ''
                  }`}
                >
                  <span className="line-clamp-1 flex-1 text-[13.5px]">
                    {shortTitle(p.title, 72)}
                  </span>
                  <span className="meta tnum shrink-0">{p.id}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => submit(q)}
                className="block w-full bg-volt px-4 py-2.5 text-left text-[13px] font-bold hover:bg-fg hover:text-volt"
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
