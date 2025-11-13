import { fillRectCtx, lineToCtx, strokeRectCtx } from './canvasUtils'
import { drawChevron } from './chevron'
import { getPairedColor, getSingletonColor } from './color'
import { CHEVRON_WIDTH } from './util'

import type { ChainData, ReducedFeature } from './fetchChains'
import type { FlatbushEntry } from './flatbushType'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function drawPairChains({
  ctx,
  type,
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
  type: string
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
  for (const computedChain of computedChains) {
    const { id, chain, minX, maxX } = computedChain

    // Guard clause: skip non-paired-end chains
    let isPairedEnd = false
    for (const element of chain) {
      if (element.flags & 1) {
        isPairedEnd = true
        break
      }
    }
    if (!isPairedEnd) {
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
    const hasBothMates = nonSupplementary.length === 2

    // Get colors based on whether both mates are visible
    const [pairedFill, pairedStroke] = hasBothMates
      ? getPairedColor({
          type,
          v0: nonSupplementary[0]!,
          v1: nonSupplementary[1]!,
          stats: chainData.stats,
        }) || ['#888', '#888']
      : getSingletonColor(nonSupplementary[0] || chain[0]!, chainData.stats)

    // Draw connecting line for pairs with both mates visible
    if (hasBothMates) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!
      const r1s = view.bpToPx({
        refName: asm.getCanonicalRefName2(v0.refName),
        coord: v0.start,
      })?.offsetPx
      const r2s = view.bpToPx({
        refName: asm.getCanonicalRefName2(v1.refName),
        coord: v1.start,
      })?.offsetPx

      if (r1s !== undefined && r2s !== undefined) {
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          r1s - view.offsetPx,
          lineY,
          r2s - view.offsetPx,
          lineY,
          ctx,
          '#666',
        )
      }
    }

    // Draw the paired-end features (both mates or singleton)
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

      const xPos = s.offsetPx - viewOffsetPx
      const width = Math.max(e.offsetPx - s.offsetPx, 3)

      if (renderChevrons) {
        drawChevron(
          ctx,
          xPos,
          chainY,
          width,
          featureHeight,
          feat.strand,
          pairedFill,
          CHEVRON_WIDTH,
          pairedStroke,
        )
      } else {
        fillRectCtx(xPos, chainY, width, featureHeight, ctx, pairedFill)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, pairedStroke)
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
