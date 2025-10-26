import { fillRectCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand'
import { CHEVRON_WIDTH } from '../shared/util'

import type { LinearReadStackDisplayModel } from './model'
import type { ChainData, ReducedFeature } from '../shared/fetchChains'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function drawLongReadChains({
  ctx,
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
  const { chains } = chainData

  for (const chain of chains) {
    // Skip if this is a paired-end read (handled by drawPairChains)
    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))
    if (nonSupplementary.length === 2) {
      continue
    }

    const isSingleton = chain.length === 1
    const c1 = nonSupplementary.length > 0 ? nonSupplementary[0]! : chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    const chainId = c1.id
    const chainY = chainYOffsets.get(chainId)

    if (chainY === undefined) {
      continue
    }

    // Draw connecting line for long reads
    if (nonSupplementary.length > 2 || nonSupplementary.length === 1) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstPx = view.bpToPx({
        refName:
          asm.getCanonicalRefName(firstFeat.refName) || firstFeat.refName,
        coord: firstFeat.start,
      })?.offsetPx
      const lastPx = view.bpToPx({
        refName: asm.getCanonicalRefName(lastFeat.refName) || lastFeat.refName,
        coord: lastFeat.end,
      })?.offsetPx

      if (firstPx !== undefined && lastPx !== undefined) {
        const startX = firstPx - view.offsetPx
        const endX = lastPx - view.offsetPx
        const startY = chainY + featureHeight / 2 - 0.5
        const endY = chainY + featureHeight / 2 - 0.5

        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }
    }

    // Draw the features
    for (const feat of chain) {
      const { refName, start, end } = feat
      const s = view.bpToPx({ refName, coord: start })
      const e = view.bpToPx({ refName, coord: end })
      if (s && e) {
        const effectiveStrand = feat.strand * primaryStrand
        const xPos = s.offsetPx - view.offsetPx
        const width = Math.max(e.offsetPx - s.offsetPx, 3)

        // Determine color based on whether it's a singleton
        let featureFill: string
        let featureStroke: string
        if (isSingleton) {
          const [fill, stroke] = getSingletonColor(feat, chainData.stats)
          featureFill = fill
          featureStroke = stroke
        } else {
          const c =
            effectiveStrand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
          featureFill = fillColor[c]
          featureStroke = strokeColor[c]
        }

        if (renderChevrons) {
          drawChevron(
            ctx,
            xPos,
            chainY,
            width,
            featureHeight,
            effectiveStrand,
            featureFill,
            CHEVRON_WIDTH,
            featureStroke,
          )
        } else {
          fillRectCtx(xPos, chainY, width, featureHeight, ctx, featureFill)
          strokeRectCtx(xPos, chainY, width, featureHeight, ctx, featureStroke)
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
        })
      }
    }
  }
}
