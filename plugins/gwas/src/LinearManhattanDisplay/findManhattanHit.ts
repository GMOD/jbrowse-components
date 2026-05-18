import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'

import type {
  ManhattanRenderState,
} from './manhattanBackendTypes.ts'
import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

const HIT_RADIUS_PX = 8

// Finds the closest point within the hit radius.
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: WiggleRenderBlock[],
  regionData: ReadonlyMap<number, ManhattanRpcResult>,
  state: ManhattanRenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight } = state
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of blocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !refName) {
      continue
    }
    const [bpStart, bpEnd] = block.bpRangeX
    const { screenStartPx, screenEndPx, reversed } = block
    const { positions, scores, numFeatures } = data
    for (let i = 0; i < numFeatures; i++) {
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
