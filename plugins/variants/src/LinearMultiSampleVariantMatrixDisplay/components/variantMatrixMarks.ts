import { defineMark } from '@jbrowse/render-core/marks'

import { matrixCellMark } from './matrixCellMark.ts'

import type {
  MatrixRenderState,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'

export const VARIANT_MATRIX_MARKS = [
  defineMark({
    shape: matrixCellMark,
    channels: (d: VariantMatrixUploadData) => ({
      featureIndex: d.cellFeatureIndices,
      rowIndex: d.cellRowIndices,
      color: d.cellColors,
      count: d.numCells,
    }),
    params: (s: MatrixRenderState, d: VariantMatrixUploadData) => ({
      numFeatures: d.numFeatures,
      rowHeight: s.rowHeight,
      scrollTop: s.scrollTop,
    }),
  }),
]
