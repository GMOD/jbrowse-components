import type { Feature } from '@jbrowse/core/util'

/**
 * Multiple adapter passes can yield the same feature more than once. First
 * occurrence wins, and insertion order is the adapter's, so a caller indexing
 * into the result keeps a stable order across a re-fetch.
 *
 * `admit` runs here rather than in a second pass, because the render RPC's
 * density gate reports `size` as its feature count and must gate on the same
 * number it reports.
 */
export function dedupeFeaturesById(
  features: Iterable<Feature>,
  admit: (feature: Feature) => boolean = () => true,
) {
  const byId = new Map<string, Feature>()
  for (const f of features) {
    const id = f.id()
    if (!byId.has(id) && admit(f)) {
      byId.set(id, f)
    }
  }
  return byId
}
