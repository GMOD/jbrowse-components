import type { Feature, Region } from '@jbrowse/core/util'

/**
 * Put a merged multi-region feature stream into the order the view draws it in,
 * left to right, and drop the duplicates merging produced.
 *
 * Matrix mode lays out one column per entry in list order and the connector zone
 * ties column i to its feature's genomic x, so the list order IS the column
 * order. Anything else draws the connectors crossed.
 *
 * This is the LD display's convention (`RenderLDDataRPC/reversedRegions.ts`) and
 * hic's (`mirrorUInRegion`), and it is the reason the matrix no longer carries a
 * `flipped` mirror of its own: the reflection maps each region **onto itself**,
 * so a view with some regions reversed and some not comes out right, which one
 * global mirror of the whole column axis cannot express.
 *
 * Rank comes from the region's position in the view-order `regions` array rather
 * than from the order the runs arrived in. Arrival order is not the view's:
 * `getFeaturesInMultipleRegions` merges the per-region fetches and emits them as
 * they land, and a minus-strand gene with its introns collapsed (six reversed
 * regions, six concurrent fetches) came back globally ascending under a ruler
 * running the other way.
 *
 * A feature is assigned to the first region it overlaps and appears once, the
 * same rule and the same dedupe as `groupFeaturesByRegion` — merge does not
 * dedupe, so a feature spanning two fetched regions arrives twice. A feature
 * overlapping no region keeps its arrival order at the end rather than being
 * dropped; the caller asked for these features and losing one silently would be
 * worse than a column out of place.
 */
export function orderByScreenPosition<T>(
  items: T[],
  regions: Region[],
  getFeature: (item: T) => Feature,
): T[] {
  const regionsByRefName = new Map<string, { region: Region; rank: number }[]>()
  for (const [rank, region] of regions.entries()) {
    let list = regionsByRefName.get(region.refName)
    if (!list) {
      list = []
      regionsByRefName.set(region.refName, list)
    }
    list.push({ region, rank })
  }

  const seen = new Set<string>()
  const ranked: { item: T; rank: number; pos: number; arrival: number }[] = []
  const unplaced: T[] = []
  for (const [arrival, item] of items.entries()) {
    const feature = getFeature(item)
    const start = feature.get('start')
    const end = feature.get('end')
    const hit = regionsByRefName
      .get(feature.get('refName'))
      ?.find(({ region }) => end > region.start && start < region.end)
    if (!hit) {
      unplaced.push(item)
      continue
    }
    const id = feature.id()
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    ranked.push({
      item,
      rank: hit.rank,
      // the reflection: inside a reversed region, screen x rises as bp falls
      pos: hit.region.reversed ? -start : start,
      arrival,
    })
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.pos - b.pos || a.arrival - b.arrival,
  )
  return [...ranked.map(r => r.item), ...unplaced]
}
