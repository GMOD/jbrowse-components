export interface DotplotGeometryData {
  x1Hi: Float32Array
  x1Lo: Float32Array
  y1Hi: Float32Array
  y1Lo: Float32Array
  x2Hi: Float32Array
  x2Lo: Float32Array
  y2Hi: Float32Array
  y2Lo: Float32Array
  padHs: Float32Array
  padVs: Float32Array
  colors: Uint32Array
  instanceCount: number
}

export interface DotplotRenderState {
  viewBpHHi: number
  viewBpHLo: number
  bpPerPxHInv: number
  viewBpVHi: number
  viewBpVLo: number
  bpPerPxVInv: number
  lineWidth: number
  displayKeys: readonly number[]
}

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(displayKey: number, data: DotplotGeometryData): void
  deleteGeometry(displayKey: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
