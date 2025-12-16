import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand'
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
  // Setup rendering configuration from PileupRenderer
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth')
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
  const canvasWidth = region.widthPx

  const getStrandColorKey = (strand: number) =>
    strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'

  // Context is already translated to region.offsetPx, so coordinates are relative to region
  const regionStart = region.start
  const regionEnd = region.end
  const regionRefName = region.refName

  let lastFillStyle = ''
  forEachWithStopTokenCheck(computedChains, stopToken, computedChain => {
    const { id, chain } = computedChain

    // Guard clause: skip paired-end reads (handled by drawPairChains)
    let isPairedEnd = false
    for (const element of chain) {
      if (element.get('flags') & 1) {
        isPairedEnd = true
        break
      }
    }
    if (isPairedEnd) {
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
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    // Draw if either end overlaps this region - clipping handles the bounds
    if (!isSingleton) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstRefName = firstFeat.get('refName')
      const lastRefName = lastFeat.get('refName')
      const firstStart = firstFeat.get('start')
      const firstEnd = firstFeat.get('end')
      const lastStart = lastFeat.get('start')
      const lastEnd = lastFeat.get('end')

      const firstInRegion =
        firstRefName === regionRefName &&
        firstStart < regionEnd &&
        firstEnd > regionStart
      const lastInRegion =
        lastRefName === regionRefName &&
        lastStart < regionEnd &&
        lastEnd > regionStart

      if (firstInRegion || lastInRegion) {
        // Calculate line endpoints - use actual positions, clipping will crop
        const firstPx = firstInRegion
          ? (firstStart - regionStart) / bpPerPx
          : firstStart < regionStart
            ? -1000
            : canvasWidth + 1000
        const lastPx = lastInRegion
          ? (lastEnd - regionStart) / bpPerPx
          : lastEnd < regionStart
            ? -1000
            : canvasWidth + 1000

        const lineY = chainY + featureHeight / 2
        lineToCtx(firstPx, lineY, lastPx, lineY, ctx, '#6665')
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
          effectiveStrand,
          featureFill,
          CHEVRON_WIDTH,
          featureStroke,
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

        if (featureFill && lastFillStyle !== featureFill) {
          ctx.fillStyle = featureFill
          lastFillStyle = featureFill
        }

        ctx.fillRect(xPos, chainY, width, featureHeight)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, featureStroke)
      }

      // Render mismatches - context is already translated so renderMismatches
      // coordinates will work directly with this region
      renderMismatchesCallback({
        ctx,
        feat: layoutFeat,
        checkRef: true,
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
      })
    }
  })
}
