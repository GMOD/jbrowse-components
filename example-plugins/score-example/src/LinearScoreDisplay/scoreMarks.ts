// #exampleFile shared | ScoreRenderState, the mark list (one `score` mark over the RPC payload) and the backend type
import { defineMark } from '@jbrowse/render-core/marks'

import { scoreMark } from './scoreMark.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

// #region render-state
// Recomputed cheaply every frame without fetching. Carries the canvas
// dimensions (required, to size the backing store) plus the one setting the
// drawing reads.
export interface ScoreRenderState {
  canvasWidth: number
  canvasHeight: number
  // packed ABGR (`cssColorToABGR`), resolved once in the model so both backends
  // are handed the same number
  color: number
}
// #endregion

// #region marks
// What this display draws, as a declaration: which of the payload's arrays
// feed which of the shape's lanes, and which of the render state's values reach
// its uniforms. Both are lenses that run once per block per frame. The pass and
// its packer, the painter (which is also the SVG export) and the hit test all
// come from the shape.
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

// The backend `createMarkBackend` builds from the list, specialized to this
// display's payload and render state
export type ScoreRenderingBackend = PerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
>
