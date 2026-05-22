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

import type { MonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'

export type VariantMatrixBackend = MonolithicBackend<
  VariantMatrixUploadData,
  MatrixRenderState
>
