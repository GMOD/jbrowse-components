import type { Feature, Region } from '@jbrowse/core/util'

/**
 * Put a merged multi-region feature stream into genomic-ascending order, and
 * drop the duplicates merging produced.
 *
 * Only the matrix display needs this, and it needs it badly. Matrix mode lays
 * out one column per entry in list order and the connector zone ties column i
 * to its feature's genomic x, so the list order IS the column order — and the
 * display's `flipped` mirror (data column `i` drawn at `n-1-i` when every
 * visible region is reversed) is only a mirror of *ascending* order. Both halves
 * assumed an order nothing established: `getFeaturesInMultipleRegions` merges
 * the per-region fetches and emits them as they arrive, which is per-region
 * ordered at best. One region hid it — a single fetch does arrive ascending —
 * and a minus-strand gene with its introns collapsed is where it showed: six
 * reversed regions, six interleaved fetches, and a mirror applied to an order
 * that was already roughly descending, so every connector line crossed.
 *
 * Ascending within a refName, refNames in the order the view's regions first
 * name them, arrival order as the final tie-break so the result is stable.
 * Deduped by feature id: merge does not dedupe, so a feature spanning two
 * fetched regions arrives once per region and would otherwise take two columns.
 */
export function orderByGenomicPosition<T>(
  items: T[],
  regions: Region[],
  getFeature: (item: T) => Feature,
): T[] {
  const refNameRank = new Map<string, number>()
  for (const region of regions) {
    if (!refNameRank.has(region.refName)) {
      refNameRank.set(region.refName, refNameRank.size)
    }
  }

  const seen = new Set<string>()
  const ranked: { item: T; rank: number; start: number; arrival: number }[] = []
  for (const [arrival, item] of items.entries()) {
    const feature = getFeature(item)
    const id = feature.id()
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    ranked.push({
      item,
      // a refName the regions never named sorts after the ones they did rather
      // than at 0, where it would silently lead the list
      rank: refNameRank.get(feature.get('refName')) ?? refNameRank.size,
      start: feature.get('start'),
      arrival,
    })
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.start - b.start || a.arrival - b.arrival,
  )
  return ranked.map(r => r.item)
}
