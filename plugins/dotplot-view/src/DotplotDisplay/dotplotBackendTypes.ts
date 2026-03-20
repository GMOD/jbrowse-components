export interface DotplotGeometryData {
  x1s: Float32Array
  y1s: Float32Array
  x2s: Float32Array
  y2s: Float32Array
  colors: Float32Array
  instanceCount: number
}

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(data: DotplotGeometryData): void
  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    scaleX: number,
    scaleY: number,
  ): void
  dispose(): void
}
