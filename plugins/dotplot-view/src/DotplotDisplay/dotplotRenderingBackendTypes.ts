// Per-feature line segment geometry, in SoA form. Coordinates are absolute
// genomic cumBp (Float64Array) — the hi/lo split for shader precision is
// applied at GPU upload only, never in plain JS.
export interface DotplotGeometryData {
  x1: Float64Array
  y1: Float64Array
  x2: Float64Array
  y2: Float64Array
  colors: Uint32Array
  instanceCount: number
}

export interface DotplotRenderState {
  // Absolute genomic cumBp position of the left/top edge of the view.
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  lineWidth: number
  displayKeys: readonly number[]
}

export interface DotplotRenderingBackend {
  resize(width: number, height: number): void
  uploadGeometry(displayKey: number, data: DotplotGeometryData): void
  deleteGeometry(displayKey: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
