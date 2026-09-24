import type { Feature } from '@jbrowse/core/util'

export interface LookupRegion {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

/**
 * One list per displayed region, holding every item whose record overlaps it.
 * A record spanning two regions goes in both, since each region draws from its
 * own list. Overlap, not a start inside the region: a large DEL that began to
 * the left still covers the region.
 */
export function groupFeaturesByRegion<T>(
  items: T[],
  regions: LookupRegion[],
  getFeature: (item: T) => Feature,
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
  const result = new Map<number, T[]>()
  for (const item of items) {
    const feature = getFeature(item)
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
          list.push(item)
        }
      }
    }
  }
  return result
}
