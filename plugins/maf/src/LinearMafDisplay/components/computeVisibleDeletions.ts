import { forEachDeletion } from '../../LinearMafRenderer/rendering/forEachDeletion.ts'

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

interface DeletionView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

interface ComputeVisibleDeletionsParams {
  view: DeletionView
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
  const scale = 1 / view.bpPerPx
  const h = rowHeight * rowProportion
  const offset = (rowHeight - h) / 2

  for (const vr of view.visibleRegions) {
    const regionData = rpcDataMap.get(vr.displayedRegionIndex)
    if (!regionData) {
      continue
    }
    const reversed = vr.reversed ?? false
    const bpToPx = reversed
      ? (bp: number) => vr.screenStartPx + (vr.end - bp) * scale
      : (bp: number) => vr.screenStartPx + (bp - vr.start) * scale
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
