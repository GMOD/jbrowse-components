import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'

import type { ManhattanRenderState } from './manhattanRenderingBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type Flatbush from '@jbrowse/core/util/flatbush'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// 2D hit test. The Flatbush index over (bp, score) is built worker-side per
// region and wrapped by the display model's `flatbushMap` view (MobX-cached so
// it survives mousemoves without rebuild). Here we derive a (bp, score) query
// box from the mouse position + current view and only check exact pixel
// distance for points inside that box. Edge-clamped points (out-of-domain
// scores pinned to the canvas top/bottom) are still catchable because the
// query window is widened to ±Inf in score when the mouse is within
// hit-radius of the canvas edge.
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
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of blocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const flatbush = flatbushMap.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !flatbush || !refName) {
      continue
    }
    const { screenStartPx, screenEndPx, reversed, start, end } = block
    const blockWidthPx = screenEndPx - screenStartPx
    if (blockWidthPx <= 0) {
      continue
    }
    const bpPerPx = (end - start) / blockWidthPx
    const mouseBp = reversed
      ? start + (screenEndPx - mouseX) * bpPerPx
      : start + (mouseX - screenStartPx) * bpPerPx
    const halfBp = HIT_RADIUS_PX * bpPerPx
    const candBpMin = mouseBp - halfBp
    const candBpMax = mouseBp + halfBp
    if (candBpMax < start || candBpMin > end) {
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
    const candidates = flatbush.search(
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
        start,
        end,
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
