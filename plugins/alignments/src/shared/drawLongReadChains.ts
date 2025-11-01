import { fillRectCtx, strokeRectCtx } from './canvasUtils'
import { drawChevron } from './chevron'
import { fillColor, getSingletonColor, strokeColor } from './color'
import { getPrimaryStrandFromFlags } from './primaryStrand'
import { CHEVRON_WIDTH } from './util'

import type { ChainData, ReducedFeature } from './fetchChains'
import type { FlatbushEntry } from './flatbushType'
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
  computedChains,
}: {
  ctx: CanvasRenderingContext2D
  chainData: ChainData
  view: LGV
  asm: Assembly
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  featuresForFlatbush: FlatbushEntry[]
  computedChains: {
    distance: number
    minX: number
    maxX: number
    chain: ReducedFeature[]
    id: string
  }[]
}): void {
  for (const { id, chain, minX, maxX } of computedChains) {
    // Filter out supplementary alignments for read type determination
    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))

    // Skip if this is a paired-end read (handled by drawPairChains)
    if (nonSupplementary.length === 2) {
      continue
    }

    const isSingleton = chain.length === 1
    const c1 = nonSupplementary.length > 0 ? nonSupplementary[0]! : chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    // Draw connecting line for long reads
    if (nonSupplementary.length > 2 || nonSupplementary.length === 1) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstPx = view.bpToPx({
        refName: asm.getCanonicalRefName2(firstFeat.refName),
        coord: firstFeat.start,
      })?.offsetPx
      const lastPx = view.bpToPx({
        refName: asm.getCanonicalRefName2(lastFeat.refName),
        coord: lastFeat.end,
      })?.offsetPx

      if (firstPx !== undefined && lastPx !== undefined) {
        const startX = firstPx - view.offsetPx
        const endX = lastPx - view.offsetPx
        const startY = chainY + featureHeight / 2 - 0.5
        const endY = chainY + featureHeight / 2 - 0.5

        ctx.beginPath()
        ctx.strokeStyle = '#666'
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
      }
    }

    // Draw the features
    for (const feat of chain) {
      const { refName, start, end } = feat
      const refName2 = asm.getCanonicalRefName2(refName)
      const s = view.bpToPx({ refName: refName2, coord: start })
      const e = view.bpToPx({ refName: refName2, coord: end })
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
          chainId: id,
          chainMinX: minX - view.offsetPx,
          chainMaxX: maxX - view.offsetPx,
          chain,
        })
      }
    }
  }
}
