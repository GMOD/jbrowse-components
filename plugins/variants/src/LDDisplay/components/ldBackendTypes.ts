export interface LDRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  signedLD: boolean
  viewScale: number
  viewOffsetX: number
  uniformW: number
}

export interface LDUploadData {
  ldValues: Float32Array
  boundaries: Float32Array
  numCells: number
  // Present only for genomic positions mode (pre-computed per-cell positions)
  positions?: Float32Array
  cellSizes?: Float32Array
}

export interface LDBackend {
  uploadData(data: LDUploadData): void
  uploadColorRamp(colors: Uint8Array): void
  render(state: LDRenderState): void
  dispose(): void
}
