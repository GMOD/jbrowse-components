// Per-feature line segment geometry, in SoA form. Coordinates are absolute
// genomic cumBp (Float64Array); the CPU/SVG renderers consume them directly.
// The GPU renderer stores each coord window-relative (cumBp - base) as a single
// Float32 at upload, using `baseH`/`baseV` — the per-axis viewport-start cumBp
// captured when this geometry was built. Keeping on-screen coords near the base
// makes a single Float32 sub-pixel accurate, so no hi/lo split is needed.
export interface DotplotGeometryData {
  x1: Float64Array
  y1: Float64Array
  x2: Float64Array
  y2: Float64Array
  colors: Uint32Array
  instanceCount: number
  // Fetch-time viewport-start cumBp per axis; the GPU precision anchor. The
  // CPU/SVG paths ignore these (they render from absolute cumBp).
  baseH: number
  baseV: number
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
