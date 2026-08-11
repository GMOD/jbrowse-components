import type { Region } from '@jbrowse/core/util'

export interface BpIndexViewSnap {
  bpPerPx: number
  displayedRegions: Region[]
}

export interface RegionIndexEntry {
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

// The displayed region an alignment block belongs to: of the regions showing
// this refName, the one its genomic span [lo,hi] overlaps most, or undefined
// when it overlaps none of them.
//
// `bpToCumBp` answers a different question — "which region CONTAINS this one
// coordinate" — and returns undefined for a coordinate outside every region.
// That is right for a point lookup and wrong for a block: an alignment that
// straddles a displayed region's edge has one endpoint outside it, and asking
// per-endpoint drops the whole block rather than drawing the part that is in
// view. Resolving the region from the span once, then projecting both endpoints
// into it, is what lets the caller clamp instead of drop.
//
// Overlap is compared rather than containment because a refName can be shown at
// several loci at once (a multi-locus view, a dispersed duplication), and a
// block that straddles one of them is not contained by any.
export function findRegionEntry(
  idx: BpRegionIndex,
  refName: string,
  lo: number,
  hi: number,
): RegionIndexEntry | undefined {
  const list = idx.entries.get(refName)
  if (!list) {
    return undefined
  }
  let best: RegionIndexEntry | undefined
  let bestOverlap = 0
  for (const entry of list) {
    const r = entry.region
    const overlap = Math.min(hi, r.end) - Math.max(lo, r.start)
    if (overlap > bestOverlap || (best === undefined && overlap >= 0)) {
      bestOverlap = overlap
      best = entry
    }
  }
  return best
}

// Cumulative bp of a coordinate within one already-resolved region, clamped to
// that region's own span. Unlike `bpToCumBp` this cannot fail: the caller has
// already decided which region the block belongs to, so a coordinate past the
// edge projects to the edge — a ribbon that runs off the side of the region
// rather than a ribbon that is not drawn.
export function cumBpInEntry(entry: RegionIndexEntry, coord: number) {
  const r = entry.region
  const clamped = Math.min(Math.max(coord, r.start), r.end)
  return entry.bpBefore + (r.reversed ? r.end - clamped : clamped - r.start)
}

// The cumBp that genomic coordinate 0 of this region's refName maps to, i.e.
// `cumBpInEntry` with the clamp removed and extrapolated back to the origin.
// Deliberately outside the region — usually far outside, and negative for a
// forward region — because it is a PHASE, not a position: a consumer laying a
// round-genomic-coordinate grid over cumBp needs only `anchor mod pitch` to
// know where the grid's ticks fall. Direction is not encoded, and does not need
// to be: a reversed region walks the same grid backwards, which is the same set
// of tick positions.
export function cumBpAtGenomicZero(entry: RegionIndexEntry) {
  const r = entry.region
  return entry.bpBefore + (r.reversed ? r.end : -r.start)
}
