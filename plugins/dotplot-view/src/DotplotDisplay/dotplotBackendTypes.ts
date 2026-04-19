export interface TrackScale {
  displayKey: number
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
  // bpPerPx the buffer was built at; render-time scale = bpPerPx / view.bpPerPx
  bpPerPxH: number
  bpPerPxV: number
}

export interface DotplotRenderState {
  offsetX: number
  offsetY: number
  lineWidth: number
  trackScales: readonly TrackScale[]
}

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(displayKey: number, data: DotplotGeometryData): void
  deleteGeometry(displayKey: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
