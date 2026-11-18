import { defineMark } from '@jbrowse/render-core/marks'

import { matrixCellMark } from './matrixCellMark.ts'

import type { VariantRenderState } from '../components/variantRenderingBackendTypes.ts'
import type { VariantMatrixUploadData } from './variantMatrixRenderingBackendTypes.ts'

export const VARIANT_MATRIX_MARKS = [
  defineMark({
    shape: matrixCellMark,
    channels: (d: VariantMatrixUploadData) => ({
      featureIndex: d.cellFeatureIndices,
      row: d.cellRowIndices,
      color: d.cellColors,
      count: d.numCells,
    }),
    params: (s: VariantRenderState, d: VariantMatrixUploadData) => ({
      numFeatures: d.featureInfo.length,
      rowHeight: s.rowHeight,
      scrollTop: s.scrollTop,
      snapScale: s.snapScale,
    }),
  }),
]
