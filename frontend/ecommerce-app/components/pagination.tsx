import Link from 'next/link'
import { formatCount } from '@/lib/format'

/**
 * Pagination over result sets that reach 2,218 pages.
 *
 * A numbered strip of every page is impossible at that size, so this shows a
 * window around the current page with the first and last always reachable, and
 * states the position in words as well. Ellipses are rendered as a span rather
 * than a disabled link, since there is nothing there to activate.
 */
export function Pagination({
  page,
  pages,
  basePath,
  params,
}: {
  page: number
  pages: number
  basePath: string
  params: Record<string, string>
}) {
  if (pages <= 1) return null

  const href = (p: number) => {
    const qs = new URLSearchParams(params)
    if (p > 1) qs.set('page', String(p))
    else qs.delete('page')
    const s = qs.toString()
    return s ? `${basePath}?${s}` : basePath
  }

  const window = new Set<number>([1, pages, page])
  for (let d = 1; d <= 2; d++) {
    if (page - d > 1) window.add(page - d)
    if (page + d < pages) window.add(page + d)
  }
  const shown = [...window].sort((a, b) => a - b)

  return (
    <nav
      className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-rule pt-4"
      aria-label="Pagination"
    >
      <span className="label">
        Page <span className="tnum text-ink">{formatCount(page)}</span> of{' '}
        <span className="tnum text-ink">{formatCount(pages)}</span>
      </span>

      <div className="ml-auto flex items-center gap-1">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-line" rel="prev">
            Prev
          </Link>
        )}

        {shown.map((p, i) => {
          const gap = i > 0 && p - shown[i - 1] > 1
          return (
            <span key={p} className="flex items-center gap-1">
              {gap && <span className="label px-1">…</span>}
              {p === page ? (
                <span
                  className="btn pointer-events-none tnum"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link href={href(p)} className="btn btn-line tnum">
                  {p}
                </Link>
              )}
            </span>
          )
        })}

        {page < pages && (
          <Link href={href(page + 1)} className="btn btn-line" rel="next">
            Next
          </Link>
        )}
      </div>
    </nav>
  )
}
