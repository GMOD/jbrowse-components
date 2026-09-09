// #exampleFile shared | ScoreRenderState, the mark list (one `score` mark over the RPC payload) and the backend type
import { defineMark } from '@jbrowse/render-core/marks'

import { scoreMark } from './scoreMark.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// #region render-state
// Recomputed cheaply every frame without fetching: the canvas dimensions
// (required, to size the backing store) plus the one setting the drawing reads
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  // packed ABGR (`cssColorToABGR`), resolved once in the model so both backends
  // are handed the same number
  color: number
}
// #endregion

// #region marks
// Which of the payload's arrays feed which of the shape's lanes, and which
// render-state values reach its uniforms: two lenses, run once per block per
// frame. Everything that draws comes from the shape.
export const SCORE_MARKS = [
  defineMark({
    shape: scoreMark,
    channels: (d: ScoreRegionData) => ({
      startBp: d.starts,
      endBp: d.ends,
      score: d.scores,
      count: d.numFeatures,
    }),
    params: (s: ScoreRenderState) => ({ color: s.color }),
  }),
]
// #endregion

export type ScoreRenderingBackend = PerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
>
