import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { getPairedColor } from '../shared/color'
import { CHEVRON_WIDTH } from '../shared/util'
import {
  featureOverlapsRegion,
  getConnectingLineEndpoint,
  getMismatchRenderingConfig,
} from './drawChainsUtil'

import type { ChainData, ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { ThemeOptions } from '@mui/material'

export function drawPairChains({
  ctx,
  type,
  chainData,
  chainYOffsets,
  renderChevrons,
  featureHeight,
  computedChains,
  config,
  theme: configTheme,
  region,
  canvasWidth,
  bpPerPx,
  colorBy,
  stopToken,
}: {
  ctx: CanvasRenderingContext2D
  type: string
  chainData: ChainData
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  computedChains: {
    distance: number
    minX: number
    maxX: number
    chain: Feature[]
    id: string
  }[]
  config: AnyConfigurationModel
  theme: ThemeOptions
  canvasWidth: number
  region: BaseBlock
  bpPerPx: number
  colorBy: ColorBy
  stopToken?: string
}): void {
  const mismatchConfig = getMismatchRenderingConfig(
    ctx,
    config,
    configTheme,
    colorBy,
  )
  let lastColor = ''

  const regionStart = region.start
  const regionEnd = region.end

  forEachWithStopTokenCheck(computedChains, stopToken, computedChain => {
    const { id, chain } = computedChain

    // Guard clause: skip non-paired-end chains
    let isPairedEnd = false
    for (const element of chain) {
      if (element.get('flags') & 1) {
        isPairedEnd = true
        break
      }
    }
    if (!isPairedEnd) {
      return
    }

    let chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      return
    }

    // Collect non-supplementary alignments
    const nonSupplementary: Feature[] = []
    for (const element of chain) {
      if (!(element.get('flags') & 2048)) {
        nonSupplementary.push(element)
      }
    }
    const hasBothMates = nonSupplementary.length === 2

    // Get colors for this read pair/singleton
    const feat = nonSupplementary[0] || chain[0]!
    const [pairedFill, pairedStroke] = getPairedColor({
      type,
      v0: feat,
      stats: chainData.stats,
    }) || ['lightgrey', '#888']

    // Draw connecting line for pairs with both mates visible
    if (hasBothMates) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!

      const v0Start = v0.get('start')
      const v1Start = v1.get('start')

      const v0InRegion = featureOverlapsRegion(
        v0.get('refName'),
        v0Start,
        v0.get('end'),
        region,
      )
      const v1InRegion = featureOverlapsRegion(
        v1.get('refName'),
        v1Start,
        v1.get('end'),
        region,
      )

      if (v0InRegion || v1InRegion) {
        const r1s = getConnectingLineEndpoint(
          v0InRegion,
          v0Start,
          regionStart,
          bpPerPx,
          canvasWidth,
        )
        const r2s = getConnectingLineEndpoint(
          v1InRegion,
          v1Start,
          regionStart,
          bpPerPx,
          canvasWidth,
        )
        const lineY = chainY + featureHeight / 2
        lineToCtx(r1s, lineY, r2s, lineY, ctx, '#6665')
      }
    }

    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const featRefName = feat.get('refName')
      const featStart = feat.get('start')
      const featEnd = feat.get('end')

      if (!featureOverlapsRegion(featRefName, featStart, featEnd, region)) {
        continue
      }

      const clippedStart = Math.max(featStart, regionStart)
      const clippedEnd = Math.min(featEnd, regionEnd)
      let xPos = (clippedStart - regionStart) / bpPerPx
      let width = Math.max((clippedEnd - clippedStart) / bpPerPx, 3)

      const layoutFeat = {
        feature: feat,
        heightPx: featureHeight,
        topPx: chainY,
      }

      if (renderChevrons) {
        drawChevron(
          ctx,
          xPos,
          chainY,
          width,
          featureHeight,
          feat.get('strand'),
          pairedFill,
          CHEVRON_WIDTH,
          pairedStroke,
        )
      } else {
        if (width < 0) {
          xPos += width
          width = -width
        }
        if (featureHeight < 0) {
          chainY += featureHeight
        }

        if (pairedFill) {
          if (lastColor !== pairedFill) {
            ctx.fillStyle = pairedFill
            lastColor = pairedFill
          }
        }

        ctx.fillRect(xPos, chainY, width, featureHeight)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, pairedStroke)
      }

      renderMismatchesCallback({
        ctx,
        feat: layoutFeat,
        bpPerPx,
        regions: [region],
        canvasWidth,
        checkRef: true,
        ...mismatchConfig,
      })
    }
  })
}
