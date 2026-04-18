export interface MatrixRenderState {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  numFeatures: number
}

export interface VariantMatrixBackend {
  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint32Array
    numCells: number
  }): void
  render(state: MatrixRenderState): void
  dispose(): void
}
