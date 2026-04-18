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

export interface VariantMatrixBackend {
  uploadCellData(data: VariantMatrixUploadData): void
  render(state: MatrixRenderState): void
  dispose(): void
}
