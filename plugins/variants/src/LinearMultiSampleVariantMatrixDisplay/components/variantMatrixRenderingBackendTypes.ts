import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  flipped: boolean
}

// Map a data column index (genomic-ascending) to its on-screen column index. On
// a horizontally-flipped view the mirror runs columns right-to-left so they
// track the reversed ruler; the mapping is its own inverse (mirror twice ==
// identity), so screen->data hit-tests use the same call. Shared by the GPU
// shader (baked into `variantMatrix.slang`), the Canvas2D/SVG renderer, the
// connector lines, and the cell hit-test so all five stay pixel-aligned.
export function mirrorColumnIndex(
  index: number,
  numFeatures: number,
  flipped: boolean,
): number {
  return flipped ? numFeatures - 1 - index : index
}

export interface VariantMatrixUploadData {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  numCells: number
  numFeatures: number
}

export type VariantMatrixRenderingBackend = GlobalRenderingBackend<
  VariantMatrixUploadData,
  MatrixRenderState
>
