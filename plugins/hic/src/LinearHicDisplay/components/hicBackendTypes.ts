export interface HicRenderState {
  binWidth: number
  yScalar: number
  canvasWidth: number
  canvasHeight: number
  maxScore: number
  useLogScale: boolean
  viewScale: number
  viewOffsetX: number
}

export interface HicBackend {
  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }): void
  uploadColorRamp(colors: Uint8Array): void
  render(state: HicRenderState): void
  dispose(): void
}
