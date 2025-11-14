import { fillRectCtx, lineToCtx, strokeRectCtx } from './canvasUtils'
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
  flipStrandLongReadChains,
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
  flipStrandLongReadChains: boolean
}): void {
  const getStrandColorKey = (strand: number) =>
    strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'

  for (const computedChain of computedChains) {
    const { id, chain, minX, maxX } = computedChain

    // Guard clause: skip paired-end reads (handled by drawPairChains)
    let isPairedEnd = false
    for (const element of chain) {
      if (element.flags & 1) {
        isPairedEnd = true
        break
      }
    }
    if (isPairedEnd) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    // Collect non-supplementary alignments
    const nonSupplementary: ReducedFeature[] = []
    for (const element of chain) {
      if (!(element.flags & 2048)) {
        nonSupplementary.push(element)
      }
    }
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    if (!isSingleton) {
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
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          firstPx - view.offsetPx,
          lineY,
          lastPx - view.offsetPx,
          lineY,
          ctx,
          '#6665',
        )
      }
    }

    // Draw the features
    const viewOffsetPx = view.offsetPx
    const chainMinXPx = minX - viewOffsetPx
    const chainMaxXPx = maxX - viewOffsetPx

    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const s = view.bpToPx({
        refName: asm.getCanonicalRefName2(feat.refName),
        coord: feat.start,
      })
      const e = view.bpToPx({
        refName: asm.getCanonicalRefName2(feat.refName),
        coord: feat.end,
      })

      if (!s || !e) {
        continue
      }

      const effectiveStrand =
        isSingleton || !flipStrandLongReadChains
          ? feat.strand
          : feat.strand * primaryStrand

      const [featureFill, featureStroke] = isSingleton
        ? getSingletonColor(feat, chainData.stats)
        : [
            fillColor[getStrandColorKey(effectiveStrand)],
            strokeColor[getStrandColorKey(effectiveStrand)],
          ]

      const xPos = s.offsetPx - viewOffsetPx
      const width = Math.max(e.offsetPx - s.offsetPx, 3)

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
        chainMinX: chainMinXPx,
        chainMaxX: chainMaxXPx,
        chain,
      })
    }
  }
}
