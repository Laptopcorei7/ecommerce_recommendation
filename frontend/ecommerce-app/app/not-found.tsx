import Link from 'next/link'

/**
 * 404.
 *
 * Reachable in a way it was not before: the product route now calls notFound()
 * for an id that is not in the catalogue, and a category slug that names no
 * bucket does the same, where previously both rendered hardcoded content for
 * any input at all.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1400px] px-4">
      <div className="page-head">
        <p className="pill mb-4">404</p>
        <h1 className="display">No such page.</h1>
      </div>
      <p className="max-w-[58ch] text-[16px] leading-relaxed text-fg-2">
        If you were looking for a product, the part number may not be in this
        catalogue: it holds 62,222 items from the Electronics 5-core benchmark,
        which is a subset of Amazon&apos;s full listing.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/catalog" className="btn">
          Search the catalogue
        </Link>
        <Link href="/" className="btn btn-line">
          Front page
        </Link>
      </div>
    </div>
  )
}
