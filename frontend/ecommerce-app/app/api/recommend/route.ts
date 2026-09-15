/**
 * Recommendations for the client-side panel.
 *
 * The recommendations page lets you switch user and drag alpha, both of which
 * change the result on every interaction, so that page cannot be a static
 * server render. It calls here instead of calling the model service directly.
 * CORS is configured for a direct browser call and it would work, but going
 * through the server keeps the service address out of the bundle and leaves
 * one place to add auth or rate limiting later.
 */

import { NextResponse } from 'next/server'
import { ApiError, getRecommendations } from '@/lib/api'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const userId = params.get('user_id')
  if (!userId) {
    return NextResponse.json({ detail: 'user_id is required' }, { status: 400 })
  }

  const topN = Number(params.get('top_n') ?? 12)
  const rawAlpha = params.get('alpha')
  const alpha = rawAlpha === null ? undefined : Number(rawAlpha)

  if (!Number.isFinite(topN) || topN < 1 || topN > 100) {
    return NextResponse.json({ detail: 'top_n must be 1 to 100' }, { status: 400 })
  }
  if (alpha !== undefined && (!Number.isFinite(alpha) || alpha < 0 || alpha > 1)) {
    return NextResponse.json({ detail: 'alpha must be 0 to 1' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getRecommendations(userId, topN, alpha))
  } catch (err) {
    const e = err as ApiError
    return NextResponse.json(
      { detail: e.message ?? 'recommendation failed' },
      { status: e.status ?? 500 },
    )
  }
}
