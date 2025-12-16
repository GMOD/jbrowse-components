import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand'
import { CHEVRON_WIDTH } from '../shared/util'
import {
  chainIsPairedEnd,
  collectNonSupplementary,
  featureOverlapsRegion,
  getConnectingLineEndpoint,
  getMismatchRenderingConfig,
} from './drawChainsUtil'

import type { ChainData, ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { ThemeOptions } from '@mui/material'

export function drawLongReadChains({
  ctx,
  chainData,
  chainYOffsets,
  renderChevrons,
  featureHeight,
  computedChains,
  flipStrandLongReadChains,
  config,
  theme: configTheme,
  region,
  bpPerPx,
  colorBy,
  stopToken,
}: {
  ctx: CanvasRenderingContext2D
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
  flipStrandLongReadChains: boolean
  config: AnyConfigurationModel
  theme: ThemeOptions
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
  const canvasWidth = region.widthPx

  const getStrandColorKey = (strand: number) =>
    strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'

  const regionStart = region.start
  const regionEnd = region.end

  let lastFillStyle = ''
  forEachWithStopTokenCheck(computedChains, stopToken, computedChain => {
    const { id, chain } = computedChain

    if (chainIsPairedEnd(chain)) {
      return
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      return
    }

    const nonSupplementary = collectNonSupplementary(chain)
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    if (!isSingleton) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstStart = firstFeat.get('start')
      const lastEnd = lastFeat.get('end')

      const firstInRegion = featureOverlapsRegion(
        firstFeat.get('refName'),
        firstStart,
        firstFeat.get('end'),
        region,
      )
      const lastInRegion = featureOverlapsRegion(
        lastFeat.get('refName'),
        lastFeat.get('start'),
        lastEnd,
        region,
      )

      if (firstInRegion || lastInRegion) {
        const firstPx = getConnectingLineEndpoint(
          firstInRegion,
          firstStart,
          regionStart,
          bpPerPx,
          canvasWidth,
        )
        const lastPx = getConnectingLineEndpoint(
          lastInRegion,
          lastEnd,
          regionStart,
          bpPerPx,
          canvasWidth,
        )
        const lineY = chainY + featureHeight / 2
        lineToCtx(firstPx, lineY, lastPx, lineY, ctx, '#6665')
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

      const featStrand = feat.get('strand')
      const effectiveStrand =
        isSingleton || !flipStrandLongReadChains
          ? featStrand
          : featStrand * primaryStrand

      const [featureFill, featureStroke] = isSingleton
        ? getSingletonColor(
            {
              tlen: feat.get('template_length'),
              pair_orientation: feat.get('pair_orientation'),
              flags: feat.get('flags'),
            },
            chainData.stats,
          )
        : [
            fillColor[getStrandColorKey(effectiveStrand)],
            strokeColor[getStrandColorKey(effectiveStrand)],
          ]

      const clippedStart = Math.max(featStart, regionStart)
      const clippedEnd = Math.min(featEnd, regionEnd)
      const xPos = (clippedStart - regionStart) / bpPerPx
      const width = Math.max((clippedEnd - clippedStart) / bpPerPx, 3)

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
          effectiveStrand,
          featureFill,
          CHEVRON_WIDTH,
          featureStroke,
        )
      } else {
        // Handle negative dimensions for SVG exports
        let drawX = xPos
        let drawY = chainY
        let drawWidth = width
        if (drawWidth < 0) {
          drawX += drawWidth
          drawWidth = -drawWidth
        }
        if (featureHeight < 0) {
          drawY += featureHeight
        }

        if (featureFill && lastFillStyle !== featureFill) {
          ctx.fillStyle = featureFill
          lastFillStyle = featureFill
        }

        ctx.fillRect(drawX, drawY, drawWidth, featureHeight)
        strokeRectCtx(drawX, drawY, drawWidth, featureHeight, ctx, featureStroke)
      }

      renderMismatchesCallback({
        ctx,
        feat: layoutFeat,
        checkRef: true,
        bpPerPx,
        regions: [region],
        canvasWidth,
        ...mismatchConfig,
      })
    }
  })
}
