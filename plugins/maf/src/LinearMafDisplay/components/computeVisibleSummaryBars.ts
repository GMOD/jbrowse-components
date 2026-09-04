import {
  bpSpanPx,
  eachVisibleRegion,
  rowViewport,
} from './visibleRegionGeometry.ts'

import type { MafStatus, MafSummaryRecord } from '../../types.ts'
import type {
  MafRowGeometryParams,
  RegionDataMap,
  VisibleRegionsView,
} from './visibleRegionGeometry.ts'

export interface SummaryBar {
  x: number
  width: number
  rowTop: number
  h: number
  score: number
  /**
   * The display row this bar sits on, and the reference extent of the summary
   * block behind it. Not read by the painter — `drawMafSummaryBars` needs only
   * the rectangle and the score — but by `findSummaryBarAt`, which is the only
   * thing that can say *what* the cursor is over on this tier: the alignment
   * blocks the ordinary hover resolves against were cleared to get here.
   */
  rowIndex: number
  start: number
  end: number
  leftStatus?: MafStatus
  rightStatus?: MafStatus
}

interface ComputeVisibleSummaryBarsParams extends MafRowGeometryParams {
  view: VisibleRegionsView
  summaryDataMap: RegionDataMap<MafSummaryRecord[]>
  /**
   * Resolves a summary row's `src` (species name) to its display row index.
   * Rows whose `src` isn't in the current source set are dropped — the summary
   * file can carry species the track config doesn't list.
   */
  rowIndexBySrc: Map<string, number>
}

/**
 * Positioned per-species presence bars for zoom-out rendering, one per summary
 * block×species in the visible regions. Each bar spans the block's reference
 * extent on its species' row, and `score` shades it (0..1 — see
 * `drawMafSummaryBars`, and note the two producers put different metrics there).
 * Mirrors `computeVisibleEmptyLines` so the summary overlay composites exactly
 * like the e-line overlay.
 *
 * `leftStatus`/`rightStatus` are not *drawn* — `drawMafSummaryBars` reads
 * `score` and nothing else — but they are read: they are the one part of a
 * `bigMafSummary` row that says what sits between two runs, and the hover
 * tooltip reports them the same way the alignment tooltip reports an i-line's
 * context. A `maf2bed --summary` BED omits the columns entirely, so every
 * consumer has to tolerate their absence.
 */
export function computeVisibleSummaryBars(
  params: ComputeVisibleSummaryBarsParams,
): SummaryBar[] {
  const { view, summaryDataMap, rowIndexBySrc, rowHeight } = params
  const bars: SummaryBar[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)

  for (const { data: records, bpToPx, overlaps } of eachVisibleRegion(
    view,
    summaryDataMap,
  )) {
    for (const r of records) {
      // Culled before the `src` lookup: the records are the *buffered*
      // region's — one per block per species, so the deepest alignments produce
      // the most of them at exactly the zoom this path exists for — and two
      // comparisons are cheaper than the map hit they skip.
      if (!overlaps(r.start, r.end)) {
        continue
      }
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex !== undefined && rowIndex >= firstRow && rowIndex < endRow) {
        // >=1px so a block narrower than a pixel still reads as present
        const { xLeft, width } = bpSpanPx(bpToPx, r.start, r.end, 1)
        bars.push({
          x: xLeft,
          width,
          rowTop: offset + rowHeight * rowIndex,
          h,
          score: r.score,
          rowIndex,
          start: r.start,
          end: r.end,
          leftStatus: r.leftStatus,
          rightStatus: r.rightStatus,
        })
      }
    }
  }
  return bars
}

/**
 * The summary bar under the cursor on `rowIndex`, or undefined.
 *
 * Hit-tested in **px against the positioned bars**, not in bp against the
 * records, and that is the whole reason it lives here rather than as a scan on
 * the model beside `rowHoverInfo`. A block narrower than a pixel is widened to
 * 1px above so it still reads as present, and at the zooms this tier exists for
 * that is most of them — a bp test would then find nothing under a bar the user
 * can plainly see and is pointing at. Reusing the array the overlay painted
 * also means the tooltip and the picture cannot disagree, and costs a scan of
 * the visible bars rather than of the whole buffered region's records.
 *
 * The row is matched by index rather than by `y` because the two are in
 * different spaces: `rowTop` is rows-canvas px, the cursor is display px, and
 * the pointer projection has already resolved the row.
 */
export function findSummaryBarAt(
  bars: readonly SummaryBar[],
  rowIndex: number,
  x: number,
): SummaryBar | undefined {
  return bars.find(
    b => b.rowIndex === rowIndex && x >= b.x && x < b.x + b.width,
  )
}
