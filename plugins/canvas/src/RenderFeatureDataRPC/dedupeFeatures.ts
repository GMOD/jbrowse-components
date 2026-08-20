import type { Feature } from '@jbrowse/core/util'

/**
 * The id-dedup every canvas feature RPC runs over what an adapter hands back,
 * since multiple adapter passes can yield the same feature more than once. First
 * occurrence wins, and insertion order is the adapter's, so a caller indexing
 * into the result (the multi-row pack's parallel arrays) keeps a stable order
 * across a re-fetch.
 *
 * `admit` is the optional admission predicate (jexl filters + showOnlyGenes +
 * solo/hidden), applied here rather than in a second pass because the render
 * RPC's density gate reports `size` as its feature count and has to gate on the
 * same number it reports.
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
