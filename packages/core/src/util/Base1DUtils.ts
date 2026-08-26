import type { BaseBlock } from './blockTypes.ts'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
}

/**
 * Offset in bp from a displayed region's **left screen edge**, which is its end
 * when the region is reversed. This one reflection is what "reversed" means
 * everywhere in a linear view: `bpToPx` below, the ruler's ticks
 * (`LinearGenomeView/util.ts`), and any display placing a feature against a
 * single block. Reach for it instead of writing `pos - region.start`, which
 * silently lays out forward under a right-to-left ruler.
 */
export function bpOffsetInRegion(
  region: { start: number; end: number; reversed?: boolean },
  bp: number,
) {
  return region.reversed ? region.end - bp : bp - region.start
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
  width: number
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
}

// total bp from the start of displayedRegions through regionIndex + regionOffset
function cumulativeBp(
  displayedRegions: { start: number; end: number }[],
  regionIndex: number,
  regionOffset: number,
) {
  let bpSoFar = regionOffset
  for (let i = 0; i < regionIndex; i++) {
    const r = displayedRegions[i]!
    bpSoFar += r.end - r.start
  }
  return bpSoFar
}

function computeTargetBpPerPx(self: MoveSnap, start: BpOffset, end: BpOffset) {
  const { displayedRegions, width } = self
  return (
    (cumulativeBp(displayedRegions, end.index, end.offset) -
      cumulativeBp(displayedRegions, start.index, start.offset)) /
    width
  )
}

function computeScrollPos(
  self: MoveSnap,
  start: BpOffset,
  bpPerPx: number,
  extraBp: number,
) {
  return Math.round(
    (cumulativeBp(self.displayedRegions, start.index, start.offset) - extraBp) /
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
  if (start && end) {
    const targetBpPerPx = computeTargetBpPerPx(self, start, end)
    const newBpPerPx = self.zoomTo(targetBpPerPx)
    const extraBp =
      targetBpPerPx < newBpPerPx
        ? ((newBpPerPx - targetBpPerPx) * self.width) / 2
        : 0
    self.scrollTo(computeScrollPos(self, start, newBpPerPx, extraBp))
  }
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

// The 0-based (BED/interbase) coordinate at a pixel by the POINT convention:
// the inverse of `bpToPx`, which maps a base to a point — and reversed, that
// point is the base's right edge. Use it for arithmetic (feature start/end,
// codon math); use `coord` only for display.
//
// `bp` is the offset from the region's left screen edge, and may be negative or
// past the region's end: pxToBp reports out-of-bounds pixels too, so this has
// to name a coordinate where no base is painted at all. That dual duty is
// exactly why the rounding stays a plain floor here — there is no rounding rule
// that is unambiguously right for both an in-bounds pixel and an extrapolated
// one.
//
// So on a reversed region this is NOT the base painted at the pixel. When the
// answer indexes per-base data, ask `basePaintedAt` instead, at a call site
// that already knows the pixel is in bounds.
function regionBase0(r: RegionSnap, bp: number) {
  return Math.floor(r.reversed ? r.end - bp : r.start + bp)
}

/**
 * The base **painted** at a pixel. Pair it with `pxToBp`'s `offset` field, and
 * only once you know the pixel is in bounds (`!oob`) — off the end of a region
 * no base is painted and the question has no answer.
 *
 * Use this rather than `coord0` whenever the result indexes per-base data: a
 * sequence string, a coverage bin, a per-base tooltip. Reversed, bp runs
 * leftward, so base b covers offsets (b, b+1] — `coord0`'s floor names b+1 on
 * b's leftmost pixel column, and names `r.end`, outside the region entirely, on
 * the region's first column.
 *
 * This is the same one-base pivot as render-core's `makeCellLeftMapper` /
 * `bpAtPx`, which is what the per-base painters draw with, so this is the
 * readout that agrees with what is on screen. The parity block in
 * `Base1DUtils.test.ts` holds the two together.
 *
 * They stay two spellings because there is no shared call to make, not because
 * of the package graph — core declares `@jbrowse/render-core` and imports it
 * from three modules already. `bpAtPx` takes a screen pixel plus a px/bp
 * projection and is mostly about the float behaviour of that projection; this
 * takes an offset already in bp and has no projection. Feeding `bpAtPx`
 * synthetic bounds to fake one computes `(offsetBp * span) / span`, which is
 * not exactly `offsetBp` at genome scale: over a 3000000-sample sweep of base
 * boundaries the perturbation named the wrong base 6885 times, every one of
 * them on a 248956422 bp region (1.9% of that span's samples) and none on any
 * span at or below 133797422. What is left to share is the two lines below, and
 * only render-core could hold them — it must not import core — which would put
 * a pixel-free function downstream of the renderer and split it from its own
 * forward twin, `bpOffsetInRegion` at the top of this file.
 */
export function basePaintedAt(
  r: { start: number; end: number; reversed?: boolean },
  offsetBp: number,
) {
  return r.reversed
    ? Math.ceil(r.end - offsetBp) - 1
    : Math.floor(r.start + offsetBp)
}

// 1-based display coord: regionBase0 + 1. Use for showing a genomic position to
// a user, not for arithmetic — round-tripping through bpToPx loses up to 1 bp
// because bpToPx accepts 0-based BED-style coords. For arithmetic use `coord0`
// (0-based) or pair `offset` with offsetBpToPx.
function regionCoord(r: RegionSnap, bp: number) {
  return regionBase0(r, bp) + 1
}

// `coord` is 1-based for display; `coord0` is its 0-based (BED/interbase)
// sibling, both by the point convention (see regionBase0 — on a reversed region
// neither names the base actually painted at the pixel; `basePaintedAt` does).
// `offset` is the raw 0-based float bp within the region — pair it with
// offsetBpToPx for an exact pixel round-trip, or with basePaintedAt for the
// base on screen.
export interface PxToBpResult extends RegionSnap {
  coord: number
  coord0: number
  index: number
  oob: boolean
  offset: number
}

function pxToBpResult(
  r: RegionSnap,
  offset: number,
  index: number,
  oob: boolean,
): PxToBpResult {
  return {
    ...r,
    oob,
    offset,
    index,
    coord: regionCoord(r, offset),
    coord0: regionBase0(r, offset),
  }
}

export function pxToBp(self: ViewLayout, px: number): PxToBpResult {
  const { bpPerPx, offsetPx, displayedRegions } = self
  const first = displayedRegions[0]
  if (!first) {
    throw new Error('pxToBp called with empty displayedRegions')
  }
  const bp = (offsetPx + px) * bpPerPx
  if (bp < 0) {
    return pxToBpResult(first, bp, 0, true)
  }

  let bpSoFar = 0

  for (let i = 0; i < displayedRegions.length; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const offset = bp - bpSoFar
    if (offset >= 0 && offset < len) {
      return pxToBpResult(r, offset, i, false)
    }
    bpSoFar += len
  }

  const last = displayedRegions.at(-1)!
  const offset = bp - bpSoFar + last.end - last.start
  return pxToBpResult(last, offset, displayedRegions.length - 1, true)
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
    cumulativeBp(self.displayedRegions, regionIndex, regionOffsetBp) /
    self.bpPerPx
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
  let bpSoFar = 0

  for (let i = 0; i < displayedRegions.length; i++) {
    const r = displayedRegions[i]!
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (displayedRegionIndex === undefined || displayedRegionIndex === i)
    ) {
      const regionOffset = bpOffsetInRegion(r, coord)
      return {
        index: i,
        offsetPx: Math.round((bpSoFar + regionOffset) / bpPerPx),
      }
    }
    bpSoFar += r.end - r.start
  }
  return undefined
}

/**
 * The {@link BpOffset} a 0-based genomic coord sits at — a region index plus an
 * offset in **bp** from that region's left screen edge, which is the shape
 * `moveTo` and `computeMoveToLayout` take.
 *
 * `bpToPx` above answers the neighbouring question in pixels and returns an
 * `index` too, so `{...bpToPx(...), offset: hit.offsetPx}` type-checks and is
 * wrong: `moveTo` re-adds the bp of every region before `index`, which
 * `offsetPx` has already counted, and divides by a bpPerPx that was never in
 * the units to begin with. Reach for this when the destination is a coordinate
 * rather than a pixel.
 *
 * Undefined when no displayed region holds the coord, same as `bpToPx`; a
 * caller that means "as far as the region goes" clamps before asking.
 */
export function bpToOffset({
  refName,
  coord,
  displayedRegions,
}: {
  refName: string
  coord: number
  displayedRegions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[]
}): BpOffset | undefined {
  for (const [index, r] of displayedRegions.entries()) {
    if (refName === r.refName && coord >= r.start && coord <= r.end) {
      return { refName, index, offset: bpOffsetInRegion(r, coord) }
    }
  }
  return undefined
}

/**
 * Where a 0-based genomic coord sits in the LINEARIZED bp space — the
 * concatenation of `displayedRegions`, which is the space `windowStartBp`
 * indexes and the one a viewport is stored in.
 *
 * `bpToPx`'s answer in those units, and without its rounding, which is the
 * reason to reach for this one: `bpToPx` quantizes to a whole pixel at the
 * CURRENT `bpPerPx`, so a caller computing a destination while the view is
 * mid-zoom — an animated flight planning its next leg — gets a destination
 * that shifts with whatever zoom it happened to ask at.
 *
 * `undefined` when no displayed region holds the coord, exactly as `bpToPx`
 * answers: a refName the view is not showing has no place on its screen.
 */
export function bpToLinearBp({
  refName,
  coord,
  displayedRegions,
}: {
  refName: string
  coord: number
  displayedRegions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[]
}) {
  const at = bpToOffset({ refName, coord, displayedRegions })
  return at ? cumulativeBp(displayedRegions, at.index, at.offset) : undefined
}

/**
 * Screen order of two {@link BpOffset}s: negative when `a` is to the left of
 * `b`. `moveTo` takes its arguments left-to-right and computes a negative
 * bpPerPx from a backwards pair, so a caller deriving the two from data that
 * can name them in either order sorts with this first.
 */
export function compareBpOffsets(a: BpOffset, b: BpOffset) {
  return a.index - b.index || a.offset - b.offset
}

// Convenience wrapper around bpToPx that matches the shape used by
// Base1DView's .bpToPx() view method — returns just the offsetPx.
export function layoutBpToPx(
  layout: ViewLayout,
  args: { refName: string; coord: number; displayedRegionIndex?: number },
) {
  return bpToPx({ ...args, self: layout })?.offsetPx
}

// A highlight's span narrowed to what `layout` can actually place. `bpToPx`
// answers only for a coord that falls inside a displayed region, so an end
// hanging past one takes the whole band down with it — a bookmark on a whole
// chromosome drew nothing at all in a view showing a slice of that chromosome,
// which is the shape every region a read-vs-ref dotplot's horizontal axis
// displays has (gatherOverlaps windows them around the aligned segments).
//
// Ends that are already inside some region of this refName are left exactly
// where they are, so a highlight spanning two same-refName regions still bands
// across both rather than being clipped to the first. Only when one is
// homeless does the first overlapping region get to clamp it.
//
// Exported for a caller that needs the two ends in the interval's OWN order —
// `getLayoutHighlightCoords` below returns min/width, which a ribbon endpoint
// cannot use.
export function clipToDisplayedRegions(
  layout: ViewLayout,
  region: { refName: string; start: number; end: number },
) {
  const [start, end] =
    region.start <= region.end
      ? [region.start, region.end]
      : [region.end, region.start]
  const rs = layout.displayedRegions.filter(r => r.refName === region.refName)
  const placeable = (c: number) => rs.some(r => c >= r.start && c <= r.end)
  if (placeable(start) && placeable(end)) {
    return { start, end }
  }
  const r = rs.find(r => start <= r.end && end >= r.start)
  return r
    ? { start: Math.max(start, r.start), end: Math.min(end, r.end) }
    : undefined
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
  const clipped = clipToDisplayedRegions(layout, region)
  if (!clipped) {
    return undefined
  }
  const s = layoutBpToPx(layout, {
    refName: region.refName,
    coord: clipped.start,
  })
  const e = layoutBpToPx(layout, {
    refName: region.refName,
    coord: clipped.end,
  })
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
}: {
  displayedRegions: RegionSnap[]
  width: number
  minimumBlockWidth?: number
}): ViewLayout {
  const totalBp = displayedRegions.reduce((acc, r) => acc + r.end - r.start, 0)
  return {
    displayedRegions,
    width,
    minimumBlockWidth,
    bpPerPx: width > 0 ? totalBp / width : 0,
    offsetPx: 0,
  }
}

export interface PxSpan {
  leftPx: number
  rightPx: number
}

/** Project a span into another pixel space: each end becomes px * scale + translatePx. */
export function transformPxSpan(
  span: PxSpan,
  scale: number,
  translatePx = 0,
): PxSpan {
  return {
    leftPx: span.leftPx * scale + translatePx,
    rightPx: span.rightPx * scale + translatePx,
  }
}

/**
 * Absolute pixel extent (measured from the layout origin) of the region blocks
 * — content and elided — but not the blank inter-region padding at the ends.
 * Since dynamic blocks only pad at the ends, the region blocks are contiguous,
 * so the first block's left edge to the last block's right edge is the full
 * extent.
 *
 * Uses block pixel geometry rather than projecting genomic coordinates because
 * coalesced elided blocks have their coordinates zeroed out, so coordinate
 * projection cannot reach them at all — and because pixel geometry is per-copy
 * correct for free, where projecting a refName would land both copies of a
 * twice-displayed region on the first.
 */
export function regionBlocksPxExtent(blocks: BaseBlock[]): PxSpan | undefined {
  const regions = blocks.filter(
    b => b.type === 'ContentBlock' || b.type === 'ElidedBlock',
  )
  const first = regions.at(0)
  const last = regions.at(-1)
  return first && last
    ? { leftPx: first.offsetPx, rightPx: last.offsetPx + last.widthPx }
    : undefined
}

/**
 * The visible regions' pixel extent projected onto an overview layout: the span
 * of the overview scalebar's "you are here" rectangle, and of the top edge of
 * the polygon drawn under it. Both read this one extent so they always describe
 * the same regions, elided ones included.
 *
 * The main view and the overview lay out the same regions from cumulative-bp 0,
 * so a main-view pixel maps to the (more zoomed-out) overview by the bpPerPx
 * ratio.
 */
export function getOverviewRegionPxSpan({
  overview,
  bpPerPx,
  blocks,
}: {
  overview: ViewLayout
  bpPerPx: number
  blocks: BaseBlock[]
}) {
  const extent = regionBlocksPxExtent(blocks)
  return extent
    ? transformPxSpan(extent, bpPerPx / overview.bpPerPx)
    : undefined
}
