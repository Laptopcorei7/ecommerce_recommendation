'use client'

/**
 * Cart and shopper identity, shared across routes and persisted.
 *
 * The previous storefront had neither. Each page held its own useState, so the
 * header badge said 3 forever, the cart page listed two invented products, and
 * adding something on the product page changed nothing anywhere else.
 *
 * Identity here is a training user id, not an account. This catalogue is the
 * Amazon Reviews 2023 benchmark and recommendations only exist for the 119,173
 * users the model was fitted on, so "sign in" would be a lie. The storefront
 * lets you pick one of those ids instead and says plainly that is what it is.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type CartLine = {
  id: string
  title: string
  price: number | null
  image: string | null
  store: string | null
  qty: number
}

type Store = {
  lines: CartLine[]
  /** False until localStorage has been read, so nothing renders a wrong count. */
  ready: boolean
  count: number
  subtotal: number
  /** Lines whose product carries no price, so the total can be honest about it. */
  unpriced: number
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
  userId: string | null
  setUserId: (id: string | null) => void
}

const CART_KEY = 'electrohub.cart.v1'
const USER_KEY = 'electrohub.user.v1'

const Ctx = createContext<Store | null>(null)

function readCart(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Anything in localStorage was written by an older build or by hand, so
    // it is validated rather than trusted.
    return parsed.flatMap((v): CartLine[] => {
      if (typeof v !== 'object' || v === null) return []
      const l = v as Record<string, unknown>
      if (typeof l.id !== 'string' || typeof l.title !== 'string') return []
      const qty = typeof l.qty === 'number' && l.qty > 0 ? Math.floor(l.qty) : 1
      return [
        {
          id: l.id,
          title: l.title,
          price: typeof l.price === 'number' ? l.price : null,
          image: typeof l.image === 'string' ? l.image : null,
          store: typeof l.store === 'string' ? l.store : null,
          qty: Math.min(qty, 99),
        },
      ]
    })
  } catch {
    // Private mode, quota, corrupt JSON. An empty cart is the right fallback.
    return []
  }
}

export function Providers({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [userId, setUserIdState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Read after mount, never during render. Reading localStorage while
  // rendering would make the server and client markup disagree.
  useEffect(() => {
    setLines(readCart())
    try {
      setUserIdState(window.localStorage.getItem(USER_KEY))
    } catch {
      /* unreadable storage is not an error worth surfacing */
    }
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines))
    } catch {
      /* a full quota must not break checkout */
    }
  }, [lines, ready])

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id)
    try {
      if (id) window.localStorage.setItem(USER_KEY, id)
      else window.localStorage.removeItem(USER_KEY)
    } catch {
      /* as above */
    }
  }, [])

  const add = useCallback((line: Omit<CartLine, 'qty'>, qty = 1) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.id === line.id)
      if (at === -1) return [...prev, { ...line, qty }]
      const next = [...prev]
      next[at] = { ...next[at], qty: Math.min(next[at].qty + qty, 99) }
      return next
    })
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, qty: Math.min(qty, 99) } : l)),
    )
  }, [])

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value = useMemo<Store>(() => {
    const count = lines.reduce((n, l) => n + l.qty, 0)
    // Unpriced lines contribute nothing to the subtotal and are counted
    // separately, because 45% of this catalogue has no price and silently
    // treating those as $0.00 would print a total that is simply wrong.
    const subtotal = lines.reduce((sum, l) => sum + (l.price ?? 0) * l.qty, 0)
    const unpriced = lines.reduce((n, l) => n + (l.price === null ? l.qty : 0), 0)
    return {
      lines, ready, count, subtotal, unpriced,
      add, setQty, remove, clear, userId, setUserId,
    }
  }, [lines, ready, userId, add, setQty, remove, clear, setUserId])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside <Providers>')
  return ctx
}
