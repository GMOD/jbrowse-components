import {
  bpSpanPx,
  eachVisibleRegion,
  rowViewport,
} from './visibleRegionGeometry.ts'

import type { MafStatus } from '../../types.ts'
import type { MafOverlayParams } from './visibleRegionGeometry.ts'

export interface EmptyLineSegment {
  x: number
  width: number
  rowTop: number
  h: number
  status: MafStatus
}

/**
 * Positioned bridge-line segments for every `e`-line (empty/bridged) row in the
 * visible blocks. The genomic extent is the block's reference span
 * [startBp, endBp); drawing (single/double line vs pale bar) is decided from
 * `status` in `drawMafEmptyLines`.
 */
export function computeVisibleEmptyLines(
  params: MafOverlayParams,
): EmptyLineSegment[] {
  const { view, rpcDataMap, rowHeight } = params
  const segments: EmptyLineSegment[] = []
  const { h, offset, firstRow, endRow } = rowViewport(params)

  // Not `eachVisibleRow`: e-lines are `block.empties`, a species with no
  // aligning sequence here, so there is no aligned row to hang them off.
  for (const { data: regionData, bpToPx, overlaps } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      if (block.empties.length > 0 && overlaps(block.startBp, block.endBp)) {
        const { xLeft, width } = bpSpanPx(bpToPx, block.startBp, block.endBp)
        for (const e of block.empties) {
          if (e.rowIndex >= firstRow && e.rowIndex < endRow) {
            segments.push({
              x: xLeft,
              width,
              rowTop: offset + rowHeight * e.rowIndex,
              h,
              status: e.status,
            })
          }
        }
      }
    }
  }
  return segments
}
