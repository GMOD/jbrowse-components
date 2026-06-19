/**
 * Geometry shared by the `computeVisible*` overlay helpers. Each one walks the
 * visible regions, maps absolute genomic bp to screen px (orientation-aware),
 * and centers a band within each row — this captures that boilerplate so the
 * helpers only express what's unique to their marker type.
 */

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
 * Per-row vertical band geometry: `h` is the drawn band height
 * (rowHeight × proportion), `offset` centers it within the row.
 */
export function rowBandGeometry(rowHeight: number, rowProportion: number) {
  const h = rowHeight * rowProportion
  return { h, offset: (rowHeight - h) / 2 }
}

/**
 * Maps an absolute genomic bp to the left-edge screen px of its cell, for a
 * single visible region. Reversed regions count down from `end`.
 */
export type BpToPx = (bp: number) => number

/**
 * Walk the visible regions that have data in `dataMap`, yielding each region's
 * data alongside its `bpToPx` mapper.
 */
export function* eachVisibleRegion<T>(
  view: VisibleRegionsView,
  dataMap: { get(idx: number): T | undefined },
): Generator<{ data: T; bpToPx: BpToPx }> {
  const scale = 1 / view.bpPerPx
  for (const vr of view.visibleRegions) {
    const data = dataMap.get(vr.displayedRegionIndex)
    if (data === undefined) {
      continue
    }
    const bpToPx: BpToPx = vr.reversed
      ? bp => vr.screenStartPx + (vr.end - bp) * scale
      : bp => vr.screenStartPx + (bp - vr.start) * scale
    yield { data, bpToPx }
  }
}
