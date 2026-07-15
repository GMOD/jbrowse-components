import type { Region } from '@jbrowse/core/util'

export interface BpIndexViewSnap {
  bpPerPx: number
  displayedRegions: Region[]
}

interface RegionIndexEntry {
  index: number
  region: Region
  bpBefore: number
}

export interface BpRegionIndex {
  entries: Map<string, RegionIndexEntry[]>
  bpPerPx: number
}

export function buildBpRegionIndex(self: BpIndexViewSnap): BpRegionIndex {
  const { displayedRegions } = self
  const entries = new Map<string, RegionIndexEntry[]>()
  let bpSoFar = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const entry: RegionIndexEntry = { index: i, region: r, bpBefore: bpSoFar }
    let list = entries.get(r.refName)
    if (!list) {
      list = []
      entries.set(r.refName, list)
    }
    list.push(entry)
    bpSoFar += r.end - r.start
  }
  return { entries, bpPerPx: self.bpPerPx }
}

// Cumulative-bp offset (bpBefore + bpOffset) of a coordinate within the region
// index, or undefined when the refName/coord isn't in the displayed regions.
export function bpToCumBp(
  idx: BpRegionIndex,
  refName: string,
  coord: number,
  displayedRegionIndex?: number,
): number | undefined {
  const list = idx.entries.get(refName)
  if (!list) {
    return undefined
  }
  for (const entry of list) {
    const r = entry.region
    if (
      coord >= r.start &&
      coord <= r.end &&
      (displayedRegionIndex === undefined ||
        displayedRegionIndex === entry.index)
    ) {
      const bpOffset = r.reversed ? r.end - coord : coord - r.start
      return entry.bpBefore + bpOffset
    }
  }
  return undefined
}
