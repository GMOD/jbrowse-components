import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export interface SyntenyTrackRenderParams {
  /** y offset (CSS px) from the top of the canvas to the top of this track */
  yTop: number
  /** drawable height (CSS px) of this track */
  height: number
  alpha: number
  /** Fade sub-pixel-thin ribbons by on-screen width; off keeps full alpha. */
  fadeThinAlignments: boolean
  minAlignmentLength: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /** Instance index of the single tile under the cursor (< 0 = none). Outlines
   * just that tile on hover, independent of the whole-feature fill highlight
   * `hoveredFeatureId` drives. */
  hoveredInstanceId: number
  /** LGV pan offsets (CSS px). Each backend converts to its own viewBp form
   * internally — the GPU path splits `offsetPx * bpPerPx` into hi/lo Float32
   * for hp-math precision; the Canvas2D path uses Float64 directly. */
  offsetPx0: number
  offsetPx1: number
  bpPerPx0: number
  bpPerPx1: number
  drawCurves: boolean
}

export interface SyntenyRenderState {
  overdrawPx: number
  /** Per-track render parameters keyed parallel to uploaded geometry. */
  perTrack: Map<number, SyntenyTrackRenderParams>
}

export interface SyntenyPickResult {
  key: number
  featureIndex: number
}

export interface SyntenyRenderingBackend {
  resize(width: number, height: number): void
  uploadGeometry(key: number, data: SyntenyInstanceData): void
  deleteGeometry(key: number): void
  render(state: SyntenyRenderState): boolean
  // Pick takes the current render state explicitly — no stale-snapshot
  // coupling with the last render() call. Callers read state from the model
  // (the same getter that feeds render) and pass it in.
  pick(
    x: number,
    y: number,
    state: SyntenyRenderState,
  ): SyntenyPickResult | undefined
  dispose(): void
}
