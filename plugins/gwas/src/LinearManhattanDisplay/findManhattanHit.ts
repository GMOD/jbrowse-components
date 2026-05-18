import { bpToScreenPx } from '@jbrowse/core/gpu/canvas2dUtils'
import { SCALE_TYPE_LOG, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type {
  WiggleGPURenderState,
  WiggleRenderBlock,
  WiggleSourceData,
} from '@jbrowse/wiggle-core'

export interface ManhattanHit {
  refName: string
  start: number
  end: number
  score: number
  screenX: number
  screenY: number
}

// Structurally a subset of WiggleSourceData — only the fields the per-point
// hit test reads. Keeping it narrow lets the test build mocks without the full
// summary/pos/neg arrays.
type ManhattanFeatureSource = Pick<
  WiggleSourceData,
  'featurePositions' | 'featureScores' | 'numFeatures'
>

const HIT_RADIUS_PX = 8

// Finds the closest point within the hit radius. Reads from the same per-region
// shape wiggle's rpcDataMap stores. Y is the score normalized into canvasHeight.
export function findManhattanHit(
  mouseX: number,
  mouseY: number,
  blocks: WiggleRenderBlock[],
  regionData: ReadonlyMap<number, { sources: ManhattanFeatureSource[] }>,
  state: WiggleGPURenderState,
  refNames: Map<number, string>,
): ManhattanHit | undefined {
  const { domainY, canvasHeight, scaleType } = state
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType === SCALE_TYPE_LOG,
  )

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
