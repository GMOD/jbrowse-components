import { insertionMark } from '@jbrowse/alignments-core'
import { defineMark } from '@jbrowse/render-core/marks'

import { cellMark } from './cellMark.ts'
import { MIN_CELL_PX } from './shaders/variant.consts.generated.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'

import type {
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

/**
 * The insertion markers over the cells: each on its cell's band, drawn where
 * it outgrows the cell's MIN_CELL_PX floor, outlined against the neighbouring
 * cells it reaches across, which are often the same colour.
 */
export function variantInsertionParams(s: VariantRenderState) {
  return {
    rowHeight: s.rowHeight,
    rowOffsetPx: -s.scrollTop,
    bandHeightPx: drawnCellHeightPx(s.rowHeight),
    spanFloorPx: MIN_CELL_PX,
    outline: true,
  }
}

export const VARIANT_MARKS = [
  defineMark({
    shape: cellMark,
    channels: (d: VariantUploadData) => ({
      startEnd: d.cellPositions,
      row: d.cellRowIndices,
      shapeType: d.cellShapeTypes,
      color: d.cellColors,
      count: d.numCells,
    }),
    params: (s: VariantRenderState) => ({
      rowHeight: s.rowHeight,
      scrollTop: s.scrollTop,
    }),
  }),
  defineMark({
    shape: insertionMark,
    channels: (d: VariantUploadData) => d.insertions,
    params: variantInsertionParams,
  }),
]
