import { eachVisibleRegion, rowBandGeometry } from './visibleRegionGeometry.ts'
import { forEachInsertion } from '../../LinearMafRenderer/rendering/forEachInsertion.ts'


import type { VisibleRegionsView } from './visibleRegionGeometry.ts'
import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface InsertionMarker {
  /** screen px of the cell boundary the marker centers on */
  xCenter: number
  rowTop: number
  h: number
  length: number
}

interface ComputeVisibleInsertionsParams {
  view: VisibleRegionsView
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
  const { h, offset } = rowBandGeometry(rowHeight, rowProportion)

  for (const { data: regionData, bpToPx } of eachVisibleRegion(
    view,
    rpcDataMap,
  )) {
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
