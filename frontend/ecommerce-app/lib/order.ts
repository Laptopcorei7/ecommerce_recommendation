import type { CartLine } from '@/app/providers'

/**
 * The order record.
 *
 * It lives in localStorage because there is nowhere else for it to go: this
 * project has no orders table, no accounts and no payment processor. Keeping
 * one order rather than a history is deliberate, so the confirmation page has
 * something true to show without pretending to be an order management system.
 */

export type Order = {
  id: string
  placedAt: string
  lines: CartLine[]
  subtotal: number
  unpriced: number
}

export const ORDER_KEY = 'electrohub.order.v1'

/**
 * Time-ordered and readable, no dependency needed. Uniqueness only has to hold
 * within one browser's storage, which holds exactly one of these.
 */
export function newOrderId(): string {
  const stamp = Date.now().toString(36).toUpperCase()
  const salt = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .toUpperCase()
    .padStart(3, '0')
  return `EH-${stamp}-${salt}`
}

export function readOrder(): Order | null {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const o = parsed as Record<string, unknown>
    if (typeof o.id !== 'string' || !Array.isArray(o.lines)) return null
    return parsed as Order
  } catch {
    return null
  }
}
