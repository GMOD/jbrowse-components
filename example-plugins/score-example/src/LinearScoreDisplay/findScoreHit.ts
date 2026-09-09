// #exampleFile shared | the display's hit walk: hands every instance of each block to the mark's `hitNearest`
import { SCORE_MARKS } from './scoreMarks.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreMarks.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface ScoreHit {
  start: number
  end: number
  // normalized 0..1, as the worker packed it
  score: number
  // where the box's ink is nearest the cursor, in canvas px
  x: number
  y: number
}

// How far outside a box the cursor may be and still pick it, so a 1px-wide
// feature is hoverable
const HIT_RADIUS_PX = 4

const MARK = SCORE_MARKS[0]!

// Back to front, so on a tie the last-painted box — the one on top — wins
function* everyInstance(count: number) {
  for (let i = count - 1; i >= 0; i--) {
    yield i
  }
}

// #region hit
// Where the ink is stays with the shape: `hitNearest` measures the cursor
// against the same rect `paintBlock` fills. This display has no spatial index,
// so it hands in every instance of every block under the cursor; one with a
// worker-built index would hand in what the index answered.
export function findScoreHit(
  xPx: number,
  yPx: number,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, ScoreRegionData>,
  state: ScoreRenderState,
): ScoreHit | undefined {
  let bestDistSq = HIT_RADIUS_PX ** 2
  let best: ScoreHit | undefined
  for (const block of blocks) {
    const data = regions.get(block.displayedRegionIndex)
    if (data) {
      const hit = MARK.hitNearest?.(
        data,
        block,
        state,
        xPx,
        yPx,
        everyInstance(data.numFeatures),
        bestDistSq,
      )
      if (hit) {
        bestDistSq = hit.distSq
        best = {
          start: data.starts[hit.index]!,
          end: data.ends[hit.index]!,
          score: data.scores[hit.index]!,
          x: hit.x,
          y: hit.y,
        }
      }
    }
  }
  return best
}
// #endregion
