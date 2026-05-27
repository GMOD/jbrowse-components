import { sum } from './index.ts'

import type { ContentBlock } from './blockTypes.ts'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

interface RegionSnap {
  start: number
  end: number
  refName: string
  reversed?: boolean
  assemblyName: string
}

interface MoveSnap {
  displayedRegions: { start: number; end: number }[]
  bpPerPx: number
  width: number
  minimumBlockWidth: number
  interRegionPaddingWidth: number
}

// Plain-object form of a Base1DView — what `bpToPx`/`pxToBp` need to do their
// work. Use this when you want a stateless projection of displayed regions to
// pixels without instantiating an MST model (e.g. the LGV "overview" header).
export interface ViewLayout {
  displayedRegions: RegionSnap[]
  bpPerPx: number
  offsetPx: number
  width: number
  minimumBlockWidth: number
  interRegionPaddingWidth: number
}

// total bp from the start of displayedRegions through regionIndex + regionOffset,
// counting inter-region padding as bp
function cumulativeBp(
  self: MoveSnap,
  regionIndex: number,
  regionOffset: number,
  bpPerPx: number,
) {
  const { displayedRegions, minimumBlockWidth, interRegionPaddingWidth } = self
  const paddingBp = interRegionPaddingWidth * bpPerPx
  let bpSoFar = regionOffset
  for (let i = 0; i < regionIndex; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    bpSoFar += len
    if (len / bpPerPx >= minimumBlockWidth && i < displayedRegions.length - 1) {
      bpSoFar += paddingBp
    }
  }
  return bpSoFar
}

function lengthBetween(
  displayedRegions: { start: number; end: number }[],
  start: BpOffset,
  end: BpOffset,
) {
  if (start.index === end.index) {
    return end.offset - start.offset
  } else {
    const s = displayedRegions[start.index]!
    let bpSoFar = s.end - s.start - start.offset
    for (let i = start.index + 1; i < end.index; i++) {
      const r = displayedRegions[i]!
      bpSoFar += r.end - r.start
    }
    bpSoFar += end.offset
    return bpSoFar
  }
}

function computeTargetBpPerPx(self: MoveSnap, start: BpOffset, end: BpOffset) {
  const {
    width,
    interRegionPaddingWidth,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth,
  } = self
  const len = lengthBetween(displayedRegions, start, end)
  let numBlocksWideEnough = 0
  for (let i = start.index; i < end.index; i++) {
    const r = displayedRegions[i]!
    if ((r.end - r.start) / bpPerPx >= minimumBlockWidth) {
      numBlocksWideEnough++
    }
  }
  return len / (width - interRegionPaddingWidth * numBlocksWideEnough)
}

function computeScrollPos(
  self: MoveSnap,
  start: BpOffset,
  bpPerPx: number,
  extraBp: number,
) {
  return Math.round(
    (cumulativeBp(self, start.index, start.offset, bpPerPx) - extraBp) /
      bpPerPx,
  )
}

export function moveTo(
  self: MoveSnap & {
    zoomTo: (arg: number) => number
    scrollTo: (arg: number) => void
  },
  start?: BpOffset,
  end?: BpOffset,
) {
  if (!start || !end) {
    return
  }
  const targetBpPerPx = computeTargetBpPerPx(self, start, end)
  const newBpPerPx = self.zoomTo(targetBpPerPx)
  const extraBp =
    targetBpPerPx < newBpPerPx
      ? ((newBpPerPx - targetBpPerPx) * self.width) / 2
      : 0
  self.scrollTo(computeScrollPos(self, start, newBpPerPx, extraBp))
}

/**
 * Pure version of moveTo: returns the {bpPerPx, offsetPx} that moveTo would
 * apply, without mutating any model. Assumes no bpPerPx clamping (i.e.
 * Base1DView with no min/maxBpPerPx).
 */
export function computeMoveToLayout(
  self: MoveSnap,
  start: BpOffset,
  end: BpOffset,
): { bpPerPx: number; offsetPx: number } {
  const bpPerPx = computeTargetBpPerPx(self, start, end)
  return { bpPerPx, offsetPx: computeScrollPos(self, start, bpPerPx, 0) }
}

// 1-based display coord: floor(within-region bp) + 1. Use for showing a
// genomic position to a user, not for arithmetic — round-tripping through
// bpToPx loses up to 1 bp because bpToPx accepts 0-based BED-style coords.
// For arithmetic, use pxToBp's `offset` field with offsetBpToPx instead.
function regionCoord(r: RegionSnap, bp: number) {
  return Math.floor(r.reversed ? r.end - bp : r.start + bp) + 1
}

// `coord` is 1-based for display; `offset` is the raw 0-based float bp within
// the region — pair with offsetBpToPx for round-trip arithmetic.
// manual return type since getSnapshot hard to infer here
export function pxToBp(
  self: ViewLayout,
  px: number,
): {
  coord: number
  index: number
  refName: string
  oob: boolean
  assemblyName: string
  offset: number
  start: number
  end: number
  reversed?: boolean
} {
  const {
    bpPerPx,
    offsetPx,
    displayedRegions,
    interRegionPaddingWidth,
    minimumBlockWidth,
  } = self
  const bp = (offsetPx + px) * bpPerPx
  if (bp < 0) {
    const r = displayedRegions[0]!
    return { ...r, oob: true, coord: regionCoord(r, bp), offset: bp, index: 0 }
  }

  const paddingBp = interRegionPaddingWidth * bpPerPx
  let bpSoFar = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (offset >= 0 && offset < len) {
      return {
        ...r,
        oob: false,
        offset,
        coord: regionCoord(r, offset),
        index: i,
      }
    }
    if (len / bpPerPx >= minimumBlockWidth && i < l - 1) {
      const paddingStart = bpSoFar + len
      if (bp >= paddingStart && bp < paddingStart + paddingBp) {
        const nextR = displayedRegions[i + 1]!
        return {
          ...nextR,
          oob: false,
          offset: 0,
          coord: regionCoord(nextR, 0),
          index: i + 1,
        }
      }
      bpSoFar += len + paddingBp
    } else {
      bpSoFar += len
    }
  }

  const r = displayedRegions.at(-1)
  if (!r) {
    throw new Error('pxToBp called with empty displayedRegions')
  }
  const offset = bp - bpSoFar + r.end - r.start
  return {
    ...r,
    oob: true,
    offset,
    coord: regionCoord(r, offset),
    index: displayedRegions.length - 1,
  }
}

// Precise within-region float-bp-offset → track-px (unrounded). Use when the
// input is pxToBp's `offset` field. Going through bpToPx with pxToBp's `coord`
// loses up to 1 bp per call because regionCoord floors+1 (1-based coord) and
// bpToPx then uses coord-r.start as a 0-based offset — visible as juddery
// cursor drift during rapid scroll-zoom.
export function offsetBpToPx(
  self: ViewLayout,
  regionIndex: number,
  regionOffsetBp: number,
): number {
  return (
    cumulativeBp(self, regionIndex, regionOffsetBp, self.bpPerPx) / self.bpPerPx
  )
}

// Accepts a 0-based genomic coord (BED-style feature.start/end). NOT a proper
// inverse of pxToBp's `coord` field, which is 1-based — for that round-trip,
// use offsetBpToPx with pxToBp's `offset` field instead.
export function bpToPx({
  refName,
  coord,
  displayedRegionIndex,
  self,
}: {
  refName: string
  coord: number
  displayedRegionIndex?: number
  self: ViewLayout
}) {
  const { bpPerPx, displayedRegions } = self

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (displayedRegionIndex === undefined || displayedRegionIndex === i)
    ) {
      const regionOffset = r.reversed ? r.end - coord : coord - r.start
      return {
        index: i,
        offsetPx: Math.round(
          cumulativeBp(self, i, regionOffset, bpPerPx) / bpPerPx,
        ),
      }
    }
  }
  return undefined
}

// Convenience wrapper around bpToPx that matches the shape used by
// Base1DView's .bpToPx() view method — returns just the offsetPx.
export function layoutBpToPx(
  layout: ViewLayout,
  args: { refName: string; coord: number; displayedRegionIndex?: number },
) {
  return bpToPx({ ...args, self: layout })?.offsetPx
}

// Map a region's start/end onto `layout` and return the pixel position+width to
// render a highlight band. `minWidth` floors the band so it stays visible when
// zoomed out far enough that it would otherwise collapse to a sub-pixel sliver.
// Math.min/Math.abs make the result independent of whether the displayed region
// is reversed.
export function getLayoutHighlightCoords(
  layout: ViewLayout,
  region: { refName: string; start: number; end: number },
  minWidth = 3,
) {
  const s = layoutBpToPx(layout, {
    refName: region.refName,
    coord: region.start,
  })
  const e = layoutBpToPx(layout, { refName: region.refName, coord: region.end })
  return s !== undefined && e !== undefined
    ? {
        width: Math.max(Math.abs(e - s), minWidth),
        left: Math.min(s, e) - layout.offsetPx,
      }
    : undefined
}

// Plain-object overview projection (the "show all displayed regions in `width`
// pixels" layout). Replaces the pattern of creating a temporary Base1DView
// MST model just to call bpToPx/pxToBp/calculateDynamicBlocks on it.
export function createOverviewLayout({
  displayedRegions,
  width,
  minimumBlockWidth = 0,
  interRegionPaddingWidth = 0,
}: {
  displayedRegions: RegionSnap[]
  width: number
  minimumBlockWidth?: number
  interRegionPaddingWidth?: number
}): ViewLayout {
  const totalBp = sum(displayedRegions.map(r => r.end - r.start))
  return {
    displayedRegions,
    width,
    minimumBlockWidth,
    interRegionPaddingWidth,
    bpPerPx: width > 0 ? totalBp / width : 0,
    offsetPx: 0,
  }
}

// Leading and trailing pixel positions of the visible content blocks projected
// onto `layout` — used to render the overview's "you are here" rectangle and
// polygon.
export function getContentBlocksPxSpan(
  layout: ViewLayout,
  contentBlocks: ContentBlock[],
) {
  const first = contentBlocks.at(0)
  const last = contentBlocks.at(-1)
  if (!first || !last) {
    return undefined
  }
  const leftPx =
    layoutBpToPx(layout, {
      refName: first.refName,
      coord: first.reversed ? first.end : first.start,
    }) ?? 0
  const rightPx =
    layoutBpToPx(layout, {
      refName: last.refName,
      coord: last.reversed ? last.start : last.end,
    }) ?? 0
  return { leftPx, rightPx }
}
