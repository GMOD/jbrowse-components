import { forEachInsertion } from '../../LinearMafRenderer/rendering/forEachInsertion.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface InsertionMarker {
  /** screen px of the cell boundary the marker centers on */
  xCenter: number
  rowTop: number
  h: number
  length: number
}

interface InsertionView {
  visibleRegions: {
    displayedRegionIndex: number
    start: number
    end: number
    screenStartPx: number
    reversed?: boolean
  }[]
  bpPerPx: number
}

interface ComputeVisibleInsertionsParams {
  view: InsertionView
  rpcDataMap: { get(idx: number): MafRegionData | undefined }
  rowHeight: number
  rowProportion: number
}

/**
 * Positioned insertion markers for every aligned row in the visible blocks.
 * Insertions are interbase, so each marker centers on the genomic boundary
 * (`anchorBp`) of the reference base following the inserted run. Geometry comes
 * from the shared `forEachInsertion` walk; drawing is shared with plugin-
 * alignments via `drawInsertionMarker`.
 */
export function computeVisibleInsertions(
  params: ComputeVisibleInsertionsParams,
): InsertionMarker[] {
  const { view, rpcDataMap, rowHeight, rowProportion } = params
  const markers: InsertionMarker[] = []
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
        forEachInsertion(
          block.refSeqBytes,
          row.alignmentBytes,
          block.startBp,
          (anchorBp, length) => {
            markers.push({ xCenter: bpToPx(anchorBp), rowTop, h, length })
          },
        )
      }
    }
  }
  return markers
}
