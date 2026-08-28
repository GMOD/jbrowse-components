/**
 * Geometry shared by the `computeVisible*` overlay helpers. Each one walks the
 * visible regions, maps absolute genomic bp to screen px (orientation-aware),
 * and centers a band within each row — this captures that boilerplate so the
 * helpers only express what's unique to their marker type.
 */

import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

/**
 * The slice of the LGV model the overlay helpers read: the visible regions
 * (each with its screen-px origin and orientation) plus the zoom level.
 */
export interface VisibleRegionsView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

/**
 * A per-region data map, read structurally so an `ObservableMap`, a plain
 * `Map`, and a test literal all satisfy it.
 */
export interface RegionDataMap<T> {
  get(idx: number): T | undefined
}

/**
 * Where the rows sit on screen. Its own interface because three overlay helpers
 * take a bespoke data map rather than `rpcDataMap` and so can't extend
 * `MafOverlayParams` — but every one of them places rows the same way, and a
 * helper that grew its own copy of these four fields could quietly be handed
 * the raw `rowHeight` sentinel or no scroll offset and mis-place every marker.
 */
export interface MafRowGeometryParams {
  /** always the *resolved* per-row height, never the `rowHeight` sentinel */
  rowHeight: number
  rowProportion: number
  /**
   * Rows-area scroll offset. Markers come back in *screen* coordinates, so a
   * helper that ignored it would place every marker a scroll-distance below the
   * cell it annotates.
   */
  scrollTop: number
  /**
   * Height of the rows viewport, for culling rows scrolled off it. A deep
   * alignment then costs what it shows rather than what it holds.
   */
  viewportHeight: number
}

/**
 * What every block-overlay helper takes: the row geometry plus the visible
 * regions and their per-region data.
 */
export interface MafOverlayParams extends MafRowGeometryParams {
  view: VisibleRegionsView
  rpcDataMap: RegionDataMap<MafRegionData>
}

/**
 * Per-row vertical band geometry: `h` is the drawn band height
 * (rowHeight × proportion, floored at the shader's `MIN_DRAWN_ROW_PX`),
 * `offset` places the band of row 0 on screen — centered within its row, then
 * shifted up by the scroll offset. Every caller spells its row top
 * `offset + rowHeight * rowIndex`, so applying the scroll here is what keeps
 * every overlay locked to the cells the canvas paints.
 *
 * Delegates to `rowRect.slang`'s generated twins so the floor and the
 * centering match the GPU pass by construction: a sub-pixel row (a legitimate
 * `rowHeight` here — see `autoRowHeight`) paints at a floored 1px band that
 * overhangs its row evenly, exactly as the shader draws it, rather than
 * thinner than the cells beneath.
 */
export function rowBandGeometry(
  rowHeight: number,
  rowProportion: number,
  scrollTop: number,
) {
  return {
    h: drawnRowHeightPx(rowHeight, rowProportion),
    offset: rowBandOffsetPx(rowHeight, rowProportion) - scrollTop,
  }
}

/**
 * Half-open `[firstRow, endRow)` range of row indices the viewport shows. The
 * per-row overlay walks skip anything outside it: with a pinned row height the
 * rows can add up to many screens, and only the ones on screen are worth
 * positioning.
 *
 * Widened by one row at each edge (via floor/ceil on the band, which is inset
 * within its row) so a partially-scrolled row still draws.
 *
 * **A filter bound, not an array bound.** `endRow` is where the viewport ends,
 * which can be past the last row that exists — deliberately, since it takes no
 * row count and nine of its callers have none to give: they test a `rowIndex`
 * the data handed them, and a bound past the end excludes nothing that exists.
 * A caller sizing a buffer or indexing rows by it needs its own
 * `Math.min(endRow, nRows)` (`drawRowIdentity`, `drawSourceChrom`). Contrast
 * `@jbrowse/core/util/virtualRange`, which clamps to a `total` because its
 * consumers size canvases from `(end - start) * cellSize`.
 */
export function visibleRowRange(
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
) {
  return {
    firstRow: Math.max(0, Math.floor(scrollTop / rowHeight)),
    endRow: Math.ceil((scrollTop + viewportHeight) / rowHeight),
  }
}

/**
 * Maps an absolute genomic bp to the left-edge screen px of its cell, for a
 * single visible region. Reversed regions count down from `end`.
 */
export type BpToPx = (bp: number) => number

/**
 * Screen-px slack added to each side of a region's genomic span before blocks
 * are culled against it. A marker is anchored inside its block but *drawn*
 * around that anchor — an insertion bar and its `(N)` label extend past the
 * cell boundary, an inversion outline is 2px wide — so a block just off-screen
 * can still paint onto the edge pixel. Wide enough to cover the widest of
 * those; the bound only has to be conservative, since anything it lets through
 * is clipped by the canvas as before.
 */
const CULL_SLACK_PX = 16

/**
 * Walk the visible regions that have data in `dataMap`, yielding each region's
 * data alongside its `bpToPx` mapper, `displayedRegionIndex` (which lets a
 * caller correlate a second per-region map — e.g. codon translation reads both
 * the alignment and the frames map), and the genomic bounds worth walking.
 *
 * `[bpLo, bpHi)` is the region's *visible* span, padded by `CULL_SLACK_PX`. It
 * matters because the per-region data is the **buffered** region — half a
 * screen of extra blocks each side — while `visibleRegions` covers only what is
 * on screen. A helper that walks a whole region therefore does roughly twice
 * the work it can show, once per frame. Testing `block.endBp > bpLo &&
 * block.startBp < bpHi` first skips those blocks before their columns are
 * walked. This is the marker-side twin of `paintedBpRange`, which does the same
 * job for the Canvas2D painters (they bound against a render block's clip
 * rather than a visible region).
 */
export function* eachVisibleRegion<T>(
  view: VisibleRegionsView,
  dataMap: { get(idx: number): T | undefined },
): Generator<{
  data: T
  bpToPx: BpToPx
  displayedRegionIndex: number
  bpLo: number
  bpHi: number
}> {
  const scale = 1 / view.bpPerPx
  const slack = CULL_SLACK_PX * view.bpPerPx + 1
  for (const vr of view.visibleRegions) {
    const data = dataMap.get(vr.displayedRegionIndex)
    if (data === undefined) {
      continue
    }
    const bpToPx: BpToPx = bp =>
      vr.screenStartPx + bpOffsetInRegion(vr, bp) * scale
    yield {
      data,
      bpToPx,
      displayedRegionIndex: vr.displayedRegionIndex,
      bpLo: vr.start - slack,
      bpHi: vr.end + slack,
    }
  }
}

/** A genomic interval's screen-px extent. */
export interface PxSpan {
  xLeft: number
  width: number
}

/**
 * Screen-px extent of the genomic interval `[startBp, endBp)`. The single place
 * the reversed-region case is handled: `bpToPx` counts down from the region end
 * there, so the interval's start maps to its *right* edge and a caller
 * subtracting the two the obvious way gets a negative width. Every overlay that
 * spans an interval — blocks, deletion runs, summary bars, CDS strips, codon
 * cells — goes through this rather than each repeating the min/abs pair.
 */
export function bpSpanPx(
  bpToPx: BpToPx,
  startBp: number,
  endBp: number,
): PxSpan {
  const xa = bpToPx(startBp)
  const xb = bpToPx(endBp)
  return { xLeft: Math.min(xa, xb), width: Math.abs(xb - xa) }
}

// NOTE: an `eachVisibleRow(params)` generator yielding one `{block, row, rowTop,
// h, bpToPx}` per aligned row reads much better than the region -> block -> row
// loop the four per-row overlays each spell out, and was tried. It is 4.7x
// slower on the walk alone (48k blocks x 26 rows, the UCSC ce11 26-way shape:
// 26ms inlined vs 120ms), because that is ~1.2M generator steps and ~1.2M
// short-lived objects per overlay per frame. `eachVisibleRegion` above is fine
// at the same job because it yields once per *region*, a handful per frame.
// Keep the loops inline; share the arithmetic (`rowBandGeometry`, `bpSpanPx`)
// instead, which costs one call per emitted marker rather than per row.
