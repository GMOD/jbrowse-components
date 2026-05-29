export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
}

export interface VariantMatrixUploadData {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  numCells: number
  numFeatures: number
}

import type { GlobalRenderingBackend } from '@jbrowse/core/gpu/globalRenderingBackend'

export type VariantMatrixRenderingBackend = GlobalRenderingBackend<
  VariantMatrixUploadData,
  MatrixRenderState
>
