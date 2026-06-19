import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'


import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface DeletionMarker {
  /** screen px of the left edge of the deleted run */
  xLeft: number
  /** screen px width of the deleted run */
  width: number
  rowTop: number
  h: number
  /** number of deleted reference bases */
  length: number
}

interface ComputeVisibleDeletionsParams {
  view: VisibleRegionsView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned deletion runs for every aligned row in the visible blocks. A
 * deletion spans reference bases `[start, start+length)`, so the marker spans
 * those cells; the overlay draws the bp count centered when it fits. Geometry
 * comes from the shared `forEachDeletion` walk, the same source the hover
 * hit-test uses.
 */
export function computeVisibleDeletions(
  params: ComputeVisibleDeletionsParams,
): DeletionMarker[] {
  const { view, rpcDataMap, rowHeight, rowProportion } = params
  const markers: DeletionMarker[] = []
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)

  for (const { data: regionData, bpToPx } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
    for (const block of regionData.blocks) {
      for (const row of block.rows) {
        const rowTop = offset + rowHeight * row.rowIndex
        forEachDeletion(
          block.refSeqBytes,
          row.alignmentBytes,
          block.startBp,
          (start, length) => {
            const x0 = bpToPx(start)
            const x1 = bpToPx(start + length)
            markers.push({
              xLeft: Math.min(x0, x1),
              width: Math.abs(x1 - x0),
              rowTop,
              h,
              length,
            })
          },
        )
      }
    }
  }
  return markers
}
