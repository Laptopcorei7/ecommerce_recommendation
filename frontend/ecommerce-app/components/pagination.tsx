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
      className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3"
      aria-label="Pagination"
    >
      <span className="text-[14px] text-fg-2">
        Page <span className="tnum font-bold text-fg">{formatCount(page)}</span> of{' '}
        <span className="tnum font-bold text-fg">{formatCount(pages)}</span>
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-line btn-sm" rel="prev">
            Prev
          </Link>
        )}

        {shown.map((p, i) => {
          const gap = i > 0 && p - shown[i - 1] > 1
          return (
            <span key={p} className="flex items-center gap-1.5">
              {gap && <span className="px-1 text-fg-3">…</span>}
              {p === page ? (
                <span
                  className="tnum flex h-9 min-w-9 items-center justify-center rounded-full bg-volt px-2 text-[13px] font-bold"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={href(p)}
                  className="tnum flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-[13px] font-semibold hover:bg-tile"
                >
                  {p}
                </Link>
              )}
            </span>
          )
        })}

        {page < pages && (
          <Link href={href(page + 1)} className="btn btn-line btn-sm" rel="next">
            Next
          </Link>
        )}
      </div>
    </nav>
  )
}
