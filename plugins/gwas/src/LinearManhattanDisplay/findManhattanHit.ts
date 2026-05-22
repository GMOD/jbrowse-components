import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'
import Flatbush from '@jbrowse/core/util/flatbush'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// Caches the Flatbush instance per ArrayBuffer so we don't rebuild the
// wrapper (and its FlatQueue) on every mousemove. The cache is weak so it
// drops automatically when a region's data is replaced or evicted.
const flatbushCache = new WeakMap<ArrayBuffer, Flatbush>()
function getFlatbush(buffer: ArrayBuffer): Flatbush {
  let fb = flatbushCache.get(buffer)
  if (!fb) {
    fb = Flatbush.from(buffer)
    flatbushCache.set(buffer, fb)
  }
  return fb
}

// 2D hit test. The Flatbush index over (bp, score) is built worker-side per
// region; here we derive a (bp, score) query box from the mouse position +
// current view and only check exact pixel distance for points inside that
// box. Edge-clamped points (out-of-domain scores pinned to the canvas top/
// bottom) are still catchable because the query window is widened to ±Inf
// in score when the mouse is within hit-radius of the canvas edge.
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: RenderBlock[],
  regionData: ReadonlyMap<number, ManhattanRpcResult>,
  state: ManhattanRenderState,
  refNames: ReadonlyMap<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight } = state
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of blocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data?.flatbushData || !refName) {
      continue
    }
    const [bpStart, bpEnd] = block.bpRangeX
    const { screenStartPx, screenEndPx, reversed } = block
    const blockWidthPx = screenEndPx - screenStartPx
    if (blockWidthPx <= 0) {
      continue
    }
    const bpPerPx = (bpEnd - bpStart) / blockWidthPx
    const mouseBp = reversed
      ? bpStart + (screenEndPx - mouseX) * bpPerPx
      : bpStart + (mouseX - screenStartPx) * bpPerPx
    const halfBp = HIT_RADIUS_PX * bpPerPx
    const candBpMin = mouseBp - halfBp
    const candBpMax = mouseBp + halfBp
    if (candBpMax < bpStart || candBpMin > bpEnd) {
      continue
    }

    const halfScore = HIT_RADIUS_PX * (range / canvasHeight)
    const mouseScore = domainMax - (mouseY / canvasHeight) * range
    const candScoreMin =
      mouseY >= canvasHeight - HIT_RADIUS_PX
        ? -Infinity
        : mouseScore - halfScore
    const candScoreMax =
      mouseY <= HIT_RADIUS_PX ? Infinity : mouseScore + halfScore

    const { positions, scores } = data
    const candidates = getFlatbush(data.flatbushData).search(
      candBpMin,
      candScoreMin,
      candBpMax,
      candScoreMax,
    )

    for (const i of candidates) {
      const pos = positions[i]!
      const score = scores[i]!
      const ptX = bpToScreenPx(
        pos,
        bpStart,
        bpEnd,
        screenStartPx,
        screenEndPx,
        reversed,
      )
      const norm = Math.max(0, Math.min(1, (score - domainMin) / range))
      const ptY = (1 - norm) * canvasHeight
      const dx = mouseX - ptX
      const dy = mouseY - ptY
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = {
          refName,
          start: pos,
          end: pos + 1,
          score,
          screenX: ptX,
          screenY: ptY,
        }
      }
    }
  }

  return best
}
