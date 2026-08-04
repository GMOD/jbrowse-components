import type { GlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'

export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
}

// A data column index IS its on-screen column index. The worker hands the
// features back in screen order (`orderByScreenPosition`), reflecting each
// reversed region onto itself the way the LD display and hic do, so no consumer
// here — GPU shader, Canvas2D/SVG renderer, connector lines, cell hit-test —
// mirrors anything. The global mirror this replaced could only express a view
// whose regions were ALL reversed.

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
