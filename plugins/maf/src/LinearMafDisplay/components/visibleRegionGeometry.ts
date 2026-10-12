/**
 * Geometry shared by the `computeVisible*` overlay helpers: walk the visible
 * regions, map absolute bp to screen px (orientation-aware), and center a band
 * within each row.
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
 * Where the rows sit on screen, shared by every overlay helper (some take a
 * bespoke data map, so they cannot extend `MafOverlayParams`) so none is handed
 * the raw `rowHeight` sentinel or no scroll offset.
 */
export interface MafRowGeometryParams {
  /** always the *resolved* per-row height, never the `rowHeight` sentinel */
  rowHeight: number
  rowProportion: number
  /**
   * Rows-area scroll offset. Markers come back in screen coordinates, so a
   * helper ignoring it would misplace every marker by the scroll distance.
   */
  scrollTop: number
  /**
   * Height of the rows viewport, for culling rows scrolled off it.
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
 * Per-row vertical band geometry: `h` is the drawn band height (rowHeight x
 * proportion, floored at the shader's `MIN_DRAWN_ROW_PX`); `offset` places row
 * 0's band, centered in its row and shifted up by the scroll offset. Callers
 * spell a row top `offset + rowHeight * rowIndex`.
 *
 * Delegates to `rowRect.slang`'s generated twins so the floor and centering
 * match the GPU pass by construction.
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
 * Half-open `[firstRow, endRow)` range of row indices the viewport shows,
 * widened by one row at each edge so a partially scrolled row still draws.
 *
 * A filter bound, not an array bound: `endRow` can be past the last row that
 * exists. A caller sizing a buffer or indexing rows needs its own
 * `Math.min(endRow, nRows)`. `@jbrowse/core/util/virtualRange` clamps instead.
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
 * The row geometry every per-row overlay opens with. Taking the params object
 * removes the positional arguments, whose swap would type-check and misplace
 * every marker. See this file's closing NOTE for why sharing the per-row walk
 * is a different question.
 */
export function rowViewport(params: MafRowGeometryParams) {
  const { rowHeight, rowProportion, scrollTop, viewportHeight } = params
  return {
    ...rowBandGeometry(rowHeight, rowProportion, scrollTop),
    ...visibleRowRange(rowHeight, scrollTop, viewportHeight),
  }
}

/**
 * Maps an absolute genomic bp to the left-edge screen px of its cell, for a
 * single visible region. Reversed regions count down from `end`.
 */
export type BpToPx = (bp: number) => number

/**
 * Screen-px slack added to each side of a region's genomic span before culling
 * blocks: markers (an insertion bar and its label, a 2px inversion outline)
 * draw past their anchor cell, so a block just off-screen can still paint on
 * the edge pixel.
 */
const CULL_SLACK_PX = 16

/**
 * A `[bpLo, bpHi)` culling range and the single test against it. Every MAF walk
 * sees the buffered region, so it skips a block before walking its columns.
 * Shared so the test has one spelling.
 */
export function bpCull(bpLo: number, bpHi: number) {
  return {
    bpLo,
    bpHi,
    overlaps: (startBp: number, endBp: number) =>
      endBp > bpLo && startBp < bpHi,
  }
}

/**
 * Walk the visible regions that have data in `dataMap`, yielding each region's
 * data with its `bpToPx` mapper, `displayedRegionIndex` (for correlating a
 * second per-region map), visible span, and its `bpCull` over that span padded
 * by `CULL_SLACK_PX`. The marker-side twin of `paintedBpRange`.
 */
export function* eachVisibleRegion<T>(
  view: VisibleRegionsView,
  dataMap: { get(idx: number): T | undefined },
) {
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
      visibleStart: vr.start,
      visibleEnd: vr.end,
      ...bpCull(vr.start - slack, vr.end + slack),
    }
  }
}

// NOTE: an `eachVisibleRow` generator was tried and is 4.7x slower on the walk
// (48k blocks x 26 rows: 26ms inlined vs 120ms), from ~1.2M generator steps and
// short-lived objects per overlay per frame. Keep the loops inline and share
// the arithmetic (`rowBandGeometry`, `spanRect`).
