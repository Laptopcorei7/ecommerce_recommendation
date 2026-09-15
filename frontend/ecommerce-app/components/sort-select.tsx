'use client'

import { useRouter } from 'next/navigation'
import { SORTS, type Sort } from '@/lib/catalog-types'

/**
 * Sort control.
 *
 * A native select rather than a custom dropdown: it is five options, it opens
 * the platform picker on a phone, and it is keyboard and screen-reader correct
 * without any of it being reimplemented. Changing it navigates, so a sorted
 * result is a real URL that can be linked, bookmarked and server-rendered.
 *
 * It takes the surrounding query as a plain object rather than a callback,
 * because props crossing from a server component to a client one have to be
 * serializable and a function is not.
 */
export function SortSelect({
  value,
  basePath,
  params,
}: {
  value: Sort
  basePath: string
  /** The other active filters, preserved when the sort changes. */
  params: Record<string, string>
}) {
  const router = useRouter()

  return (
    <label className="flex items-center gap-2">
      <span className="text-[12.5px] font-bold uppercase">Sort</span>
      <select
        value={value}
        onChange={(e) => {
          const qs = new URLSearchParams(params)
          qs.set('sort', e.target.value)
          // Changing the sort reorders the whole result set, so page 4 of the
          // old order means nothing in the new one.
          qs.delete('page')
          router.push(`${basePath}?${qs}`)
        }}
        className="field w-auto rounded-full border-0 bg-tile py-1.5 pl-4 text-[13.5px] font-medium"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  )
}
