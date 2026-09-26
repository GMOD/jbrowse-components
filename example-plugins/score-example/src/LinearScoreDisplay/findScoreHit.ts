// #exampleFile shared | the display's hit: `nearestMarkHit` asks the mark's `hitNearest`, which its `ink` implies, about every instance under the cursor
import { backToFront, nearestMarkHit } from '@jbrowse/render-core/marks'

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
  // the instance in its region, which the chrome's highlight lights
  regionIndex: number
  instance: number
}

// How far outside a box the cursor may be and still pick it, so a 1px-wide
// feature is hoverable
const HIT_RADIUS_PX = 4

// #region hit
// `nearestMarkHit` walks the blocks under the cursor and asks the mark's
// `hitNearest`, which measures the cursor against the rect its `ink`
// declares. What the display chooses is the candidates: every instance here,
// back to front so a tie goes to the box painted on top, which is enough at a
// few thousand boxes. A display with hundreds of thousands asks the encoder for
// its `index` lane — a Flatbush over (bp, score) — and answers with what that
// finds between the reach's `bpMin`/`valueMin` and `bpMax`/`valueMax` instead
// (`findMarkHit` in plugins/marks is the worked form).
export function findScoreHit(
  xPx: number,
  yPx: number,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, ScoreRegionData>,
  state: ScoreRenderState,
): ScoreHit | undefined {
  const hit = nearestMarkHit(
    SCORE_MARKS,
    blocks,
    index => regions.get(index),
    state,
    xPx,
    yPx,
    {
      radiusPx: HIT_RADIUS_PX,
      candidates: data => backToFront(0, data.count),
    },
  )
  return hit
    ? {
        start: hit.region.x[hit.index]!,
        end: hit.region.x2[hit.index]!,
        score: hit.region.y[hit.index]!,
        x: hit.x,
        y: hit.y,
        regionIndex: hit.block.displayedRegionIndex,
        instance: hit.index,
      }
    : undefined
}
// #endregion
