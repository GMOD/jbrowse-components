// Per-segment line geometry, in SoA form, with no color in it. Coordinates are
// absolute genomic cumBp (Float64Array); the CPU/SVG renderers consume them
// directly. The GPU renderer stores each coord window-relative (cumBp - base) as
// a single Float32 at upload, using `baseH`/`baseV` — the per-axis
// viewport-start cumBp captured when this geometry was built. Keeping on-screen
// coords near the base makes a single Float32 sub-pixel accurate, so no hi/lo
// split is needed.
//
// This is the rpcProps half of the rpcProps/gpuProps split: it depends on the
// fetched data and the zoom, never on the palette. `instanceFeatureIdx` maps
// each segment back to the feature it came from so colors can be recomputed
// against it alone — see `computeDotplotColors`.
export interface DotplotInstanceData {
  x1: Float64Array
  y1: Float64Array
  x2: Float64Array
  y2: Float64Array
  instanceFeatureIdx: Uint32Array
  instanceCount: number
  // Fetch-time viewport-start cumBp per axis; the GPU precision anchor. The
  // CPU/SVG paths ignore these (they render from absolute cumBp).
  baseH: number
  baseV: number
}

// What the backends draw: instance geometry joined with main-thread-computed
// per-segment colors.
export interface DotplotGeometryData extends DotplotInstanceData {
  colors: Uint32Array
}

export interface DotplotRenderState {
  // Absolute genomic cumBp position of the left/top edge of the view.
  viewBpH: number
  viewBpV: number
  bpPerPxHInv: number
  bpPerPxVInv: number
  lineWidth: number
  // Plot-wide opacity. A render parameter, NOT part of the packed color — an
  // opacity drag must not invalidate `colors` (which would recompute, re-pack
  // and re-upload every instance per frame). Mirrors synteny's
  // `SyntenyTrackRenderParams.alpha`.
  alpha: number
  displayKeys: readonly number[]
}

export interface DotplotRenderingBackend {
  resize(width: number, height: number): void
  uploadGeometry(displayKey: number, data: DotplotGeometryData): void
  deleteGeometry(displayKey: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
