import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type {
  WiggleGPURenderState,
  WiggleRenderBlock,
} from '@jbrowse/plugin-wiggle'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

interface FeatureSource {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
}

const HIT_RADIUS_PX = 8

// Finds the closest point within the hit radius. Reads from the same shape
// wiggle's rpcDataMap stores — `{ sources: [{ featurePositions, featureScores,
// numFeatures }] }` per region. Y is the score normalized into canvasHeight.
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: WiggleRenderBlock[],
  regionData: ReadonlyMap<number, { sources: FeatureSource[] }>,
  state: WiggleGPURenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight, scaleType } = state
  const normalize = makeScoreNormalizer(domainY[0], domainY[1], scaleType === 1)

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

    for (const source of data.sources) {
      const { featurePositions, featureScores, numFeatures } = source
      for (let i = 0; i < numFeatures; i++) {
        const pos = featurePositions[i * 2]!
        const score = featureScores[i]!
        const ptX = bpToScreenPx(
          pos,
          bpStart,
          bpEnd,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const ptY = (1 - normalize(score)) * canvasHeight
        const dx = mouseX - ptX
        const dy = mouseY - ptY
        const distSq = dx * dx + dy * dy
        if (distSq < bestDistSq) {
          bestDistSq = distSq
          best = {
            refName,
            start: pos,
            end: featurePositions[i * 2 + 1]!,
            score,
            screenX: ptX,
            screenY: ptY,
          }
        }
      }
    }
  }

  return best
}
