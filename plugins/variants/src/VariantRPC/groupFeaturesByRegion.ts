import type { Feature } from '@jbrowse/core/util'

export interface LookupRegion {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

/**
 * Bucket the merged multi-region feature stream back into one list per displayed
 * region. `getFeaturesInMultipleRegions` merges N per-region queries without
 * deduping, so a feature spanning two fetched regions arrives twice; assigning
 * each feature to the *first* region it overlaps and stopping there keeps one
 * copy.
 *
 * Membership is overlap, not containment of the start: a tabix query returns
 * every record whose interval intersects the region, including a large DEL/INV
 * that began far to the left. Requiring `start >= region.start` dropped those
 * from every bucket, so panning or zooming past the start of a structural
 * variant made it disappear from the display entirely.
 *
 * Uses a linear scan over the per-refName candidates rather than a pointer
 * advance so features are assigned correctly regardless of emission order from
 * merge(). R (regions per refName) is almost always 1, so the O(N*R) cost is
 * effectively O(N).
 */
export function groupFeaturesByRegion(
  features: Feature[],
  regions: LookupRegion[],
) {
  const regionsByRefName = new Map<string, LookupRegion[]>()
  for (const r of regions) {
    let list = regionsByRefName.get(r.refName)
    if (!list) {
      list = []
      regionsByRefName.set(r.refName, list)
    }
    list.push(r)
  }
  const result = new Map<number, Feature[]>()
  for (const feature of features) {
    const candidates = regionsByRefName.get(feature.get('refName'))
    if (candidates) {
      const start = feature.get('start')
      const end = feature.get('end')
      for (const region of candidates) {
        if (end > region.start && start < region.end) {
          let list = result.get(region.displayedRegionIndex)
          if (!list) {
            list = []
            result.set(region.displayedRegionIndex, list)
          }
          list.push(feature)
          break
        }
      }
    }
  }
  return result
}
