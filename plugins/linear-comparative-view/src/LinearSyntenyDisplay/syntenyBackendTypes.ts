import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

export interface SyntenyTrackRenderParams {
  /** y offset (CSS px) from the top of the canvas to the top of this track */
  yTop: number
  /** drawable height (CSS px) of this track */
  height: number
  alpha: number
  minAlignmentLength: number
  hoveredFeatureId: number
  clickedFeatureId: number
  offset0: number
  offset1: number
  bpPerPx0: number
  bpPerPx1: number
}

export interface SyntenyRenderState {
  maxOffScreenPx: number
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
  render(state: SyntenyRenderState): void
  pick(
    x: number,
    y: number,
    onResult?: (result: SyntenyPickResult | undefined) => void,
  ): SyntenyPickResult | undefined
  dispose(): void
}
