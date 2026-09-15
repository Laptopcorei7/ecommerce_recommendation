/**
 * Search suggestions for the header field.
 *
 * Kept deliberately small: the header dropdown shows a handful of matches and
 * a count, and pressing enter goes to the full /catalog page which renders on
 * the server. This exists so typing feels live, not so it can replace the
 * catalogue page.
 */

import { NextResponse } from 'next/server'
import { ApiError, getProducts } from '@/lib/api'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim()

  // One character matches a large fraction of 62,222 titles and tells the
  // reader nothing, so the field stays quiet until there is a real query.
  if (q.length < 2) {
    return NextResponse.json({ total: 0, items: [] })
  }

  try {
    const page = await getProducts({ q, perPage: 6, sort: 'popular' })
    return NextResponse.json({ total: page.total, items: page.items })
  } catch (err) {
    const e = err as ApiError
    return NextResponse.json(
      { detail: e.message ?? 'search failed' },
      { status: e.status ?? 500 },
    )
  }
}
