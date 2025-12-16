import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { getPairedColor } from '../shared/color'
import {
  CHEVRON_WIDTH,
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  setAlignmentFont,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../shared/util'

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
  // Setup rendering configuration from PileupRenderer
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth') ?? 1
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const hideSmallIndels = readConfObject(config, 'hideSmallIndels') as boolean
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  setAlignmentFont(ctx)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy.type)
  const drawIndels = shouldDrawIndels()
  let lastColor = ''

  // Context is already translated to region.offsetPx, so coordinates are relative to region
  const regionStart = region.start
  const regionEnd = region.end
  const regionRefName = region.refName

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
    // Draw if either mate overlaps this region - clipping handles the bounds
    if (hasBothMates) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!

      const v0RefName = v0.get('refName')
      const v1RefName = v1.get('refName')
      const v0Start = v0.get('start')
      const v1Start = v1.get('start')
      const v0End = v0.get('end')
      const v1End = v1.get('end')

      const v0InRegion =
        v0RefName === regionRefName && v0Start < regionEnd && v0End > regionStart
      const v1InRegion =
        v1RefName === regionRefName && v1Start < regionEnd && v1End > regionStart

      if (v0InRegion || v1InRegion) {
        // Calculate line endpoints - use actual positions, clipping will crop
        const r1s = v0InRegion
          ? (v0Start - regionStart) / bpPerPx
          : v0Start < regionStart
            ? -1000
            : canvasWidth + 1000
        const r2s = v1InRegion
          ? (v1Start - regionStart) / bpPerPx
          : v1Start < regionStart
            ? -1000
            : canvasWidth + 1000

        const lineY = chainY + featureHeight / 2
        lineToCtx(r1s, lineY, r2s, lineY, ctx, '#6665')
      }
    }

    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const featRefName = feat.get('refName')
      const featStart = feat.get('start')
      const featEnd = feat.get('end')

      // Skip features that don't overlap this region
      if (
        featRefName !== regionRefName ||
        featEnd <= regionStart ||
        featStart >= regionEnd
      ) {
        continue
      }

      // Calculate pixel positions relative to region (context is already translated)
      const clippedStart = Math.max(featStart, regionStart)
      const clippedEnd = Math.min(featEnd, regionEnd)
      let xPos = (clippedStart - regionStart) / bpPerPx
      let width = Math.max((clippedEnd - clippedStart) / bpPerPx, 3)

      // Render the alignment base shape
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
        // avoid drawing negative width features for SVG exports
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

      // Render mismatches - context is already translated so renderMismatches
      // coordinates will work directly with this region
      renderMismatchesCallback({
        ctx,
        feat: layoutFeat,
        bpPerPx,
        regions: [region],
        hideSmallIndels,
        mismatchAlpha,
        drawSNPsMuted,
        drawIndels,
        largeInsertionIndicatorScale,
        minSubfeatureWidth,
        charWidth,
        charHeight,
        colorMap,
        colorContrastMap,
        canvasWidth,
        checkRef: true,
      })
    }
  })
}
