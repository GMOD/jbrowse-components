import {
  bpSpanPx,
  eachVisibleRegion,
  rowBandGeometry,
} from './visibleRegionGeometry.ts'

import type { MafStatus, MafSummaryRecord } from '../../types.ts'
import type {
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

interface ComputeVisibleSummaryBarsParams {
  view: VisibleRegionsView
  summaryDataMap: RegionDataMap<MafSummaryRecord[]>
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
 * extent on its species' row; `score` (the UCSC bigMafSummary 0..1 normalized
 * alignment score — not percent identity, see `drawMafSummaryBars`) and the
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
      if (rowIndex !== undefined) {
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
