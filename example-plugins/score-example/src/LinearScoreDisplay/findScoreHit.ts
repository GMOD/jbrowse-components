// #exampleFile shared | the display's hit walk: hands every instance of each block to the mark's `hitNearest`
import { SCORE_MARKS } from './scoreMarks.ts'

import type { ScoreRegionData } from '../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreMarks.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface ScoreHit {
  start: number
  end: number
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
// against the same rect `paintBlock` fills. This display hands in every
// instance of every block under the cursor, which is enough at a few thousand
// boxes; a display with hundreds of thousands of instances asks the encoder
// for its `index` lane — a Flatbush over (bp, score) — and hands in what that
// answers instead (`findManhattanHit` in plugins/gwas is the worked form).
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
        everyInstance(data.count),
        bestDistSq,
      )
      if (hit) {
        bestDistSq = hit.distSq
        best = {
          start: data.x[hit.index]!,
          end: data.x2[hit.index]!,
          score: data.y[hit.index]!,
          x: hit.x,
          y: hit.y,
        }
      }
    }
  }
  return best
}
// #endregion
