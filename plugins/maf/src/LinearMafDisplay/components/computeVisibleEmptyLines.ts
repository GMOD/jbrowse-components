import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { MafStatus } from '../../types.ts'

export interface EmptyLineSegment {
  x: number
  width: number
  rowTop: number
  h: number
  status: MafStatus
}

interface EmptyLineView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

interface ComputeVisibleEmptyLinesParams {
  view: EmptyLineView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned bridge-line segments for every `e`-line (empty/bridged) row in the
 * visible blocks. The genomic extent is the block's reference span
 * [startBp, endBp); drawing (single/double line vs pale bar) is decided from
 * `status` in `drawMafEmptyLines`.
 */
export function computeVisibleEmptyLines(
  params: ComputeVisibleEmptyLinesParams,
): EmptyLineSegment[] {
  const { view, rpcDataMap, rowHeight, rowProportion } = params
  const segments: EmptyLineSegment[] = []
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
      if (block.empties.length === 0) {
        continue
      }
      const x0 = bpToPx(block.startBp)
      const x1 = bpToPx(block.endBp)
      const x = Math.min(x0, x1)
      const width = Math.abs(x1 - x0)
      for (const e of block.empties) {
        segments.push({
          x,
          width,
          rowTop: offset + rowHeight * e.rowIndex,
          h,
          status: e.status,
        })
      }
    }
  }
  return segments
}
