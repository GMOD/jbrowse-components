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

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(regionKey: number, data: DotplotGeometryData): void
  deleteGeometry(regionKey: number): void
  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    trackScales: readonly TrackScale[],
  ): void
  dispose(): void
}
