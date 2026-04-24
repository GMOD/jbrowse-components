// Shared bp ↔ screen pixel projection for a synteny view-half. One view's
// displayedRegions, bpPerPx, offsetPx, interRegionPaddingWidth, and
// minimumBlockWidth are condensed into a table the CPU path
// (Canvas2DSyntenyRenderer) and GPU path (GpuSyntenyRenderer uniforms) both
// consume. Worker output is bp + regionIdx; this helper is the only place
// that knows how to turn those back into pixels.

export interface SyntenyViewLike {
  bpPerPx: number
  offsetPx: number
  interRegionPaddingWidth: number
  minimumBlockWidth: number
  displayedRegions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
    assemblyName: string
  }[]
}

export interface ViewProjection {
  // Screen pixel of each region's bp-left-edge (the bp-zero point inside
  // the region, which is `region.start` for forward regions and `region.end`
  // for reversed). Inter-region paddings for non-elided regions are folded
  // in; the viewport `offsetPx` is already subtracted so the value is
  // directly the on-screen pixel where `bp_in_region == 0` lands.
  regionOffsetPx: Float64Array
  bpPerPx: number
}

export function buildViewProjection(view: SyntenyViewLike): ViewProjection {
  const {
    bpPerPx,
    offsetPx,
    displayedRegions,
    interRegionPaddingWidth,
    minimumBlockWidth,
  } = view
  const n = displayedRegions.length
  const regionOffsetPx = new Float64Array(n)
  let cumulativeBp = 0
  let cumulativePaddingPx = 0
  for (let i = 0; i < n; i++) {
    const r = displayedRegions[i]!
    regionOffsetPx[i] = cumulativeBp / bpPerPx + cumulativePaddingPx - offsetPx
    const len = r.end - r.start
    cumulativeBp += len
    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < n - 1) {
      cumulativePaddingPx += interRegionPaddingWidth
    }
  }
  return { regionOffsetPx, bpPerPx }
}

export function projectBpToScreenPx(
  bpInRegion: number,
  regionIdx: number,
  p: ViewProjection,
) {
  return p.regionOffsetPx[regionIdx]! + bpInRegion / p.bpPerPx
}

// Worker-side inverse: given a genomic (refName, coord, [displayedRegionIndex])
// triple, find the displayed-region index it belongs to and return its
// bp-offset-within-region (accounting for reversed regions). Returns
// undefined when no region matches — the worker drops the feature.
export function bpInRegionFromCoord(
  displayedRegions: SyntenyViewLike['displayedRegions'],
  refName: string,
  coord: number,
  displayedRegionIndex?: number,
) {
  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    if (
      r.refName === refName &&
      coord >= r.start &&
      coord <= r.end &&
      (displayedRegionIndex === undefined || displayedRegionIndex === i)
    ) {
      return {
        regionIdx: i,
        bpInRegion: r.reversed ? r.end - coord : coord - r.start,
      }
    }
  }
  return undefined
}

// Per-refName index built from a view's displayedRegions so the worker can
// look up (refName, coord) → (regionIdx, bpInRegion) in O(regions-with-this-
// refName) rather than O(all-regions) per feature. Matches today's
// buildBpToPxIndex structure minus the pixel math.
export interface BpInRegionIndex {
  entries: Map<
    string,
    {
      regionIdx: number
      start: number
      end: number
      reversed: boolean
    }[]
  >
}

export function buildBpInRegionIndex(
  displayedRegions: SyntenyViewLike['displayedRegions'],
): BpInRegionIndex {
  const entries = new Map<
    string,
    { regionIdx: number; start: number; end: number; reversed: boolean }[]
  >()
  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    let list = entries.get(r.refName)
    if (!list) {
      list = []
      entries.set(r.refName, list)
    }
    list.push({
      regionIdx: i,
      start: r.start,
      end: r.end,
      reversed: r.reversed ?? false,
    })
  }
  return { entries }
}

export function bpInRegionFromIndex(
  idx: BpInRegionIndex,
  refName: string,
  coord: number,
  displayedRegionIndex?: number,
) {
  const list = idx.entries.get(refName)
  if (!list) {
    return undefined
  }
  for (const entry of list) {
    if (
      coord >= entry.start &&
      coord <= entry.end &&
      (displayedRegionIndex === undefined ||
        displayedRegionIndex === entry.regionIdx)
    ) {
      return {
        regionIdx: entry.regionIdx,
        bpInRegion: entry.reversed ? entry.end - coord : coord - entry.start,
      }
    }
  }
  return undefined
}
