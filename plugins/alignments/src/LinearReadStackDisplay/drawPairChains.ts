import { fillRectCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import {
  getPairedInsertSizeAndOrientationColor,
  getPairedInsertSizeColor,
  getPairedOrientationColor,
} from '../shared/color'
import { CHEVRON_WIDTH } from '../shared/util'

import type { LinearReadStackDisplayModel } from './model'
import type {
  ChainData,
  ChainStats,
  ReducedFeature,
} from '../shared/fetchChains'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function drawPairChains({
  ctx,
  self,
  chainData,
  view,
  asm,
  chainYOffsets,
  renderChevrons,
  featureHeight,
  featuresForFlatbush,
}: {
  ctx: CanvasRenderingContext2D
  self: LinearReadStackDisplayModel
  chainData: ChainData
  view: LGV
  asm: Assembly
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  featuresForFlatbush: {
    x1: number
    y1: number
    x2: number
    y2: number
    data: ReducedFeature
    chainId: string
    chainMinX: number
    chainMaxX: number
    chain: ReducedFeature[]
    readsOverlap?: boolean
  }[]
}): void {
  const type = self.colorBy?.type || 'insertSizeAndOrientation'
  const { chains } = chainData

  for (const chain of chains) {
    // Skip if not a paired-end read
    if (chain.length < 2) {
      continue
    }

    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))
    if (nonSupplementary.length !== 2) {
      continue
    }

    const v0 = nonSupplementary[0]!
    const v1 = nonSupplementary[1]!
    const [pairedFill, pairedStroke] =
      getPairedColor({ type, v0, v1, stats: chainData.stats }) || []

    // Check if reads overlap based on genomic coordinates
    const refName0 = asm.getCanonicalRefName(v0.refName) || v0.refName
    const refName1 = asm.getCanonicalRefName(v1.refName) || v1.refName
    const readsOverlap =
      refName0 === refName1 &&
      v0.start < v1.end &&
      v1.start < v0.end

    // Draw connecting line for paired reads
    const r1s = view.bpToPx({
      refName: refName0,
      coord: v0.start,
    })?.offsetPx
    const r2s = view.bpToPx({
      refName: refName1,
      coord: v1.start,
    })?.offsetPx

    const chainId = v0.id
    const chainY = chainYOffsets.get(chainId)

    if (chainY !== undefined && r1s !== undefined && r2s !== undefined) {
      // Draw connecting line if reads don't overlap
      if (!readsOverlap) {
        const w = r2s - r1s
        fillRectCtx(
          r1s - view.offsetPx,
          chainY + featureHeight / 2 - 0.5,
          w,
          1,
          ctx,
          '#666',
        )
      }

      // Draw the paired reads
      for (const feat of chain) {
        const { refName, start, end } = feat
        const s = view.bpToPx({ refName, coord: start })
        const e = view.bpToPx({ refName, coord: end })
        if (s && e) {
          const xPos = s.offsetPx - view.offsetPx
          const width = Math.max(e.offsetPx - s.offsetPx, 3)
          const fillCol = pairedFill || '#888'
          const strokeCol = readsOverlap ? '#1a1a1a' : (pairedStroke || '#888')

          if (renderChevrons) {
            drawChevron(
              ctx,
              xPos,
              chainY,
              width,
              featureHeight,
              feat.strand,
              fillCol,
              CHEVRON_WIDTH,
              strokeCol,
            )
          } else {
            fillRectCtx(xPos, chainY, width, featureHeight, ctx, fillCol)
            strokeRectCtx(xPos, chainY, width, featureHeight, ctx, strokeCol)
          }

          featuresForFlatbush.push({
            x1: xPos,
            y1: chainY,
            x2: xPos + width,
            y2: chainY + featureHeight,
            data: feat,
            chainId,
            chainMinX: xPos,
            chainMaxX: xPos + width,
            chain,
            readsOverlap,
          })
        }
      }
    }
  }
}

export function getPairedColor({
  type,
  v0,
  v1,
  stats,
}: {
  type: string
  v0: ReducedFeature
  v1: ReducedFeature
  stats?: ChainStats
}): readonly [string, string] | undefined {
  if (type === 'insertSizeAndOrientation') {
    return getPairedInsertSizeAndOrientationColor(v0, v1, stats)
  }
  if (type === 'orientation') {
    return getPairedOrientationColor(v0)
  }
  if (type === 'insertSize') {
    return getPairedInsertSizeColor(v0, v1, stats)
  }
  return undefined
}
