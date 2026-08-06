import {
  bpSpanPx,
  eachVisibleRegion,
  rowBandGeometry,
  visibleRowRange,
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
 * `leftStatus`/`rightStatus` ride along **unused**: nothing draws them today.
 * They were described here as feeding "bridge decoration in
 * `drawMafSummaryBars`", which that function has never done — it reads `score`
 * and nothing else. Kept rather than dropped because they are the one part of a
 * `bigMafSummary` row that says what sits between two runs, which is what a
 * bridge decoration would need; a `maf2bed --summary` BED omits the columns
 * entirely, so anything built on them has to tolerate their absence.
 */
export function computeVisibleSummaryBars(
  params: ComputeVisibleSummaryBarsParams,
): SummaryBar[] {
  const {
    view,
    summaryDataMap,
    rowIndexBySrc,
    rowHeight,
    rowProportion,
    scrollTop,
    viewportHeight,
  } = params
  const bars: SummaryBar[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion, scrollTop)
  const { firstRow, endRow } = visibleRowRange(
    rowHeight,
    scrollTop,
    viewportHeight,
  )

  for (const { data: records, bpToPx, bpLo, bpHi } of eachVisibleRegion(
    view,
    summaryDataMap,
  )) {
    for (const r of records) {
      // The bp test first, and before the `src` lookup: the records are the
      // *buffered* region's — one per block per species, so the deepest
      // alignments produce the most of them at exactly the zoom this path
      // exists for — and two comparisons are cheaper than the map hit they
      // skip. Same `[bpLo, bpHi)` cull as the block overlays.
      if (r.end <= bpLo || r.start >= bpHi) {
        continue
      }
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex !== undefined && rowIndex >= firstRow && rowIndex < endRow) {
        const { xLeft, width } = bpSpanPx(bpToPx, r.start, r.end)
        bars.push({
          x: xLeft,
          // >=1px so a block narrower than a pixel still reads as present
          width: Math.max(1, width),
          rowTop: offset + rowHeight * rowIndex,
          h,
          score: r.score,
          leftStatus: r.leftStatus,
          rightStatus: r.rightStatus,
        })
      }
    }
  }
  return bars
}
