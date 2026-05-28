import type { Region } from '@jbrowse/core/util'

export interface BpIndexViewSnap {
  bpPerPx: number
  minimumBlockWidth: number
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

// Returns cumBp (bpBefore + bpOffset) and padPx (always 0, kept for
// compatibility with GPU shader vertex buffer layout).
export function bpToCumBpAndPad(
  idx: BpRegionIndex,
  refName: string,
  coord: number,
  displayedRegionIndex?: number,
): { cumBp: number; padPx: number } | undefined {
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
      return { cumBp: entry.bpBefore + bpOffset, padPx: 0 }
    }
  }
  return undefined
}
