import { fillRectCtx, strokeRectCtx } from './canvasUtils'
import { drawChevron } from './chevron'
import { getPairedColor } from './color'
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
  for (const { id, chain, minX, maxX } of computedChains) {
    // Filter out supplementary alignments for paired-end check
    const nonSupplementary = chain.filter(feat => !(feat.flags & 2048))

    // Skip if not a paired-end read (only 2 non-supplementary features)
    if (nonSupplementary.length !== 2) {
      continue
    }

    const v0 = nonSupplementary[0]!
    const v1 = nonSupplementary[1]!
    const [pairedFill, pairedStroke] =
      getPairedColor({ type, v0, v1, stats: chainData.stats }) || []

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    // Draw connecting line for paired reads
    const refName0 = asm.getCanonicalRefName(v0.refName) || v0.refName
    const refName1 = asm.getCanonicalRefName(v1.refName) || v1.refName

    const r1s = view.bpToPx({
      refName: refName0,
      coord: v0.start,
    })?.offsetPx
    const r2s = view.bpToPx({
      refName: refName1,
      coord: v1.start,
    })?.offsetPx

    if (r1s !== undefined && r2s !== undefined) {
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
        const strokeCol = pairedStroke || '#888'

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
          chainId: id,
          chainMinX: minX - view.offsetPx,
          chainMaxX: maxX - view.offsetPx,
          chain,
        })
      }
    }
  }
}
