import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

export interface SyntenyTrackRenderParams {
  /** y offset (CSS px) from the top of the canvas to the top of this track */
  yTop: number
  /** drawable height (CSS px) of this track */
  height: number
  alpha: number
  minAlignmentLength: number
  hoveredFeatureId: number
  clickedFeatureId: number
  /** LGV pan offsets (CSS px). Each backend converts to its own viewBp form
   * internally — the GPU path splits `offsetPx * bpPerPx` into hi/lo Float32
   * for hp-math precision; the Canvas2D path uses Float64 directly. */
  offsetPx0: number
  offsetPx1: number
  bpPerPx0: number
  bpPerPx1: number
  drawCurves: boolean
  /** true when colorBy='syri'; enables SYN-first z-ordering in renderers */
  isSyriMode: boolean
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

export interface SyntenyBackend {
  resize(width: number, height: number): void
  uploadGeometry(key: number, data: SyntenyInstanceData): void
  deleteGeometry(key: number): void
  render(state: SyntenyRenderState): boolean
  pick(x: number, y: number): SyntenyPickResult | undefined
  dispose(): void
}
