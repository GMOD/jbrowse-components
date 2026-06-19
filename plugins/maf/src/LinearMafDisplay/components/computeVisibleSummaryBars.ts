import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'

import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafStatus, MafSummaryRecord } from '../../types.ts'

export interface SummaryBar {
  x: number
  width: number
  rowTop: number
  h: number
  score: number
  leftStatus?: MafStatus
  rightStatus?: MafStatus
}

interface ComputeVisibleSummaryBarsParams {
  view: VisibleRegionsView
  summaryDataMap: { get(idx: number): MafSummaryRecord[] | undefined }
  /**
   * Resolves a summary row's `src` (species name) to its display row index.
   * Rows whose `src` isn't in the current source set are dropped — the summary
   * file can carry species the track config doesn't list.
   */
  rowIndexBySrc: Map<string, number>
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned per-species presence bars for zoom-out rendering, one per summary
 * block×species in the visible regions. Each bar spans the block's reference
 * extent on its species' row; `score` (0..1 alignment quality) and the
 * left/right `MafStatus` chars are carried through for score-shading + bridge
 * decoration in `drawMafSummaryBars`. Mirrors `computeVisibleEmptyLines` so the
 * summary overlay composites exactly like the e-line overlay.
 */
export function computeVisibleSummaryBars(
  params: ComputeVisibleSummaryBarsParams,
): SummaryBar[] {
  const { view, summaryDataMap, rowIndexBySrc, rowHeight, rowProportion } =
    params
  const bars: SummaryBar[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)

  for (const { data: records, bpToPx } of eachVisibleRegion(
    view,
    summaryDataMap,
  )) {
    for (const r of records) {
      const rowIndex = rowIndexBySrc.get(r.src)
      if (rowIndex === undefined) {
        continue
      }
      const x0 = bpToPx(r.start)
      const x1 = bpToPx(r.end)
      const x = Math.min(x0, x1)
      bars.push({
        x,
        width: Math.max(1, Math.abs(x1 - x0)),
        rowTop: offset + rowHeight * rowIndex,
        h,
        score: r.score,
        leftStatus: r.leftStatus,
        rightStatus: r.rightStatus,
      })
    }
  }
  return bars
}
