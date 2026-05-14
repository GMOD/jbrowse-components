import { normalizeScore } from './manhattanDrawUtils.ts'

import type { ManhattanRenderState } from './manhattanBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface ManhattanHit {
  refName: string
  start: number
  score: number
}

interface RegionScores {
  positions: Uint32Array
  scores: Float32Array
  numFeatures: number
}

const HIT_RADIUS_PX = 8

export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  renderBlocks: RenderBlock[],
  regionData: ReadonlyMap<number, RegionScores>,
  state: ManhattanRenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight, scaleType } = state

  let bestDistSq = HIT_RADIUS_PX * HIT_RADIUS_PX
  let best: ManhattanHit | undefined

  for (const block of renderBlocks) {
    const data = regionData.get(block.displayedRegionIndex)
    const refName = refNames.get(block.displayedRegionIndex)
    if (!data || !refName) {
      continue
    }

    const bpLen = block.bpRangeX[1] - block.bpRangeX[0]
    const blockWidth = block.screenEndPx - block.screenStartPx
    if (blockWidth <= 0 || bpLen <= 0) {
      continue
    }
    const bpPerPx = bpLen / blockWidth

    for (let i = 0; i < data.numFeatures; i++) {
      const pos = data.positions[i]!
      const score = data.scores[i]!

      const ptX = block.reversed
        ? (block.bpRangeX[1] - pos) / bpPerPx + block.screenStartPx
        : (pos - block.bpRangeX[0]) / bpPerPx + block.screenStartPx
      const ptY = (1 - normalizeScore(score, domainY, scaleType)) * canvasHeight

      const dx = mouseX - ptX
      const dy = mouseY - ptY
      const distSq = dx * dx + dy * dy
      if (distSq < bestDistSq) {
        bestDistSq = distSq
        best = { refName, start: pos, score }
      }
    }
  }

  return best
}
