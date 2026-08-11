import type { Feature } from '@jbrowse/core/util'

/**
 * The id-dedup every canvas feature RPC runs over what an adapter hands back:
 * multiple adapter passes can yield the same feature more than once, and each of
 * the three consumers pays for a duplicate differently — the render RPC would
 * count it toward the density gate and pack a second set of quads, the multi-row
 * pack would emit a duplicate block, and the clustering matrix would double-count
 * its coverage and skew the row order.
 *
 * First occurrence wins, and insertion order is the adapter's, so callers that
 * index into the result (the multi-row pack's parallel arrays) keep a stable
 * order across a re-fetch of the same region.
 *
 * `admit` is the optional admission predicate (jexl filters + showOnlyGenes +
 * solo/hidden). Applied here rather than in a second pass because the render
 * RPC's density gate reports `size` as its feature count and must gate on the
 * same number it reports.
 *
 * Shared for the same reason `measureRegionBytes` beside it is — the three call
 * sites each carried this loop plus a comment asserting it mirrored the others,
 * which is the arrangement that lets them stop mirroring.
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
