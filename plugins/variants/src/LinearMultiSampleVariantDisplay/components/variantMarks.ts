import { defineMark } from '@jbrowse/render-core/marks'

import { cellMark } from './cellMark.ts'

import type {
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

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
]
