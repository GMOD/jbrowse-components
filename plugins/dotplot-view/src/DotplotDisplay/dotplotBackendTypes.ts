export interface TrackScale {
  regionKey: number
  scaleX: number
  scaleY: number
}

export interface DotplotGeometryData {
  x1s: Float32Array
  y1s: Float32Array
  x2s: Float32Array
  y2s: Float32Array
  colors: Uint32Array
  instanceCount: number
}

export interface DotplotRenderState {
  offsetX: number
  offsetY: number
  lineWidth: number
  trackScales: readonly TrackScale[]
}

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadRegion(regionNumber: number, data: DotplotGeometryData): void
  deleteRegion(regionNumber: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
