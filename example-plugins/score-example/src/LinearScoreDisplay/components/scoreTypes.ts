import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// Recomputed cheaply every frame without fetching. Carries the canvas
// dimensions (required by the base class to size the backing store) plus the
// one setting the draw path reads.
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  color: string
}

export type ScoreRenderingBackend = PerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
>
