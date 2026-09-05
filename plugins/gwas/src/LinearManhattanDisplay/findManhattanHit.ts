import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { MANHATTAN_MARKS } from './manhattanMarks.ts'
import { yToScore } from './manhattanRenderingBackendTypes.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  // r² to the index SNP in LD mode (1 for the index, NaN where absent);
  // undefined in normal coloring mode.
  r2?: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

const MARK = MANHATTAN_MARKS[0]!

// 2D hit test. The Flatbush index over (bp, score) is built worker-side per
// region and wrapped by the display model's `flatbushes` map (kept in lockstep
// with rpcDataMap so it survives mousemoves without rebuild). Here we derive a
// (bp, score) query box from the mouse position + current view; the mark's own
// `hitNearest` then measures pixel distance to the glyph it drew.
//
// Where the ink is stays with the shape rather than here — the bar-vs-glyph
// branch is a rule the shader, the painter and this share, and the copy that
// used to live in this file is what drifts.
//
// Edge-clamped points (out-of-domain scores pinned to the canvas top/bottom)
// are still catchable because the query window is widened to ±Inf in score when
// the mouse is within hit-radius of the canvas edge.
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: RenderBlock[],
  regionData: ReadonlyMap<number, ManhattanRpcResult>,
  flatbushMap: ReadonlyMap<number, Flatbush>,
  state: ManhattanRenderState,
  refNames: ReadonlyMap<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight } = state

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of blocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const flatbush = flatbushMap.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !flatbush || !refName) {
      continue
    }
    const { screenStartPx, screenEndPx, start, end } = block
    const blockWidthPx = screenEndPx - screenStartPx
    if (blockWidthPx <= 0) {
      continue
    }
    const bpPerPx = (end - start) / blockWidthPx
    const mouseBp = bpAtPxExact(mouseX, block)
    const halfBp = HIT_RADIUS_PX * bpPerPx
    const candBpMin = mouseBp - halfBp
    const candBpMax = mouseBp + halfBp
    if (candBpMax < start || candBpMin > end) {
      continue
    }

    // ±HIT_RADIUS_PX in screen y → a score window via yToScore (which decreases
    // with y, so the lower pixel edge is the min score). Edge-clamped points
    // stay catchable by widening to ±Inf when the mouse is within hit-radius of
    // the canvas edge.
    const candScoreMin =
      mouseY >= canvasHeight - HIT_RADIUS_PX
        ? -Infinity
        : yToScore(mouseY + HIT_RADIUS_PX, domainY, canvasHeight)
    const candScoreMax =
      mouseY <= HIT_RADIUS_PX
        ? Infinity
        : yToScore(mouseY - HIT_RADIUS_PX, domainY, canvasHeight)

    const hit = MARK.hitNearest(
      data,
      block,
      state,
      mouseX,
      mouseY,
      flatbush.search(candBpMin, candScoreMin, candBpMax, candScoreMax),
      bestDistSq,
    )
    if (hit) {
      bestDistSq = hit.distSq
      // NaN r² (SNP absent from LD data) normalizes to undefined here so the
      // tooltip and feature widget can treat "no r²" uniformly.
      const raw = data.r2s?.[hit.index]
      best = {
        refName,
        start: data.positions[hit.index]!,
        end: data.ends[hit.index]!,
        score: data.scores[hit.index]!,
        r2: Number.isFinite(raw) ? raw : undefined,
        screenX: hit.x,
        screenY: hit.y,
      }
    }
  }

  return best
}
