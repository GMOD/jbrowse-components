import type { Region } from '@jbrowse/core/util'

export interface BpIndexViewSnap {
  bpPerPx: number
  interRegionPaddingWidth: number
  minimumBlockWidth: number
  displayedRegions: Region[]
}

interface RegionIndexEntry {
  index: number
  region: Region
  bpBefore: number
  paddingPxBefore: number
}

export interface BpRegionIndex {
  entries: Map<string, RegionIndexEntry[]>
  bpPerPx: number
}

export function buildBpRegionIndex(self: BpIndexViewSnap): BpRegionIndex {
  const { interRegionPaddingWidth, bpPerPx, displayedRegions, minimumBlockWidth } =
    self
  const entries = new Map<string, RegionIndexEntry[]>()
  let bpSoFar = 0
  let paddingPx = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const entry: RegionIndexEntry = {
      index: i,
      region: r,
      bpBefore: bpSoFar,
      paddingPxBefore: paddingPx,
    }
    let list = entries.get(r.refName)
    if (!list) {
      list = []
      entries.set(r.refName, list)
    }
    list.push(entry)

    bpSoFar += len
    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      paddingPx += interRegionPaddingWidth
    }
  }
  return { entries, bpPerPx }
}

// Returns cumBp (bpBefore + bpOffset, no padding) and padPx (accumulated
// inter-region gap in CSS pixels, stable across zoom levels).
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
      (displayedRegionIndex === undefined || displayedRegionIndex === entry.index)
    ) {
      const bpOffset = r.reversed ? r.end - coord : coord - r.start
      return { cumBp: entry.bpBefore + bpOffset, padPx: entry.paddingPxBefore }
    }
  }
  return undefined
}
