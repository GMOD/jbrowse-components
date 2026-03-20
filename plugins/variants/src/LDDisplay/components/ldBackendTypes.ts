export interface LDRenderState {
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  signedLD: boolean
  viewScale: number
  viewOffsetX: number
}

export interface LDBackend {
  uploadData(data: {
    positions: Float32Array
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }): void
  uploadColorRamp(colors: Uint8Array): void
  render(state: LDRenderState): void
  dispose(): void
}
