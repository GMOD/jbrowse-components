import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import {
  calculateFeaturePositionPx,
  featureOverlapsRegion,
  getChainBoundsOnRef,
  getConnectingLineColor,
  getMismatchRenderingConfig,
  renderFeatureMismatchesAndModifications,
  renderFeatureShape,
} from './drawChainsUtil'
import { lineToCtx } from '../shared/canvasUtils'
import { fillColor, getPairedColor, strokeColor } from '../shared/color'

import type { MismatchData } from './drawChainsUtil'
import type { ComputedChain } from './drawFeatsCommon'
import type {
  ChainData,
  ColorBy,
  ModificationTypeWithColor,
} from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
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
  regionStartPx,
  bpPerPx,
  colorBy,
  visibleModifications,
  stopToken,
  hideSmallIndels,
  hideMismatches,
  hideLargeIndels,
  showOutline,
}: {
  ctx: CanvasRenderingContext2D
  type: string
  chainData: ChainData
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  computedChains: ComputedChain[]
  config: AnyConfigurationModel
  theme: ThemeOptions
  region: BaseBlock
  regionStartPx: number
  bpPerPx: number
  colorBy: ColorBy
  visibleModifications?: Record<string, ModificationTypeWithColor>
  stopToken?: string
  hideSmallIndels?: boolean
  hideMismatches?: boolean
  hideLargeIndels?: boolean
  showOutline?: boolean
}): MismatchData {
  const mismatchConfig = getMismatchRenderingConfig(
    ctx,
    config,
    configTheme,
    colorBy,
    { hideSmallIndels, hideMismatches, hideLargeIndels },
  )
  const canvasWidth = region.widthPx
  const regionStart = region.start
  const colorCtx = { lastFillStyle: '' }

  const allCoords: MismatchData['coords'] = []
  const allItems: MismatchData['items'] = []
  const lastCheck = createStopTokenChecker(stopToken)

  for (const computedChain of computedChains) {
    checkStopToken2(lastCheck)
    const { id, chain, isPairedEnd, nonSupplementary } = computedChain

    if (!isPairedEnd) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const hasBothMates = nonSupplementary.length === 2

    // Get colors for this read pair/singleton
    const feat = nonSupplementary[0] || chain[0]!
    const [pairedFill, pairedStroke] = getPairedColor({
      type,
      v0: feat,
      stats: chainData.stats,
    }) || ['lightgrey', '#888']

    const lineY = chainY + featureHeight / 2

    // Check if chain has supplementary alignments
    const hasSupplementary = chain.length > nonSupplementary.length

    // Draw connecting line spanning all features in chain (including supplementary)
    if (hasBothMates) {
      const bounds = getChainBoundsOnRef(chain, region.refName)
      if (
        bounds &&
        bounds.minStart < region.end &&
        bounds.maxEnd > region.start
      ) {
        const r1s = (bounds.minStart - regionStart) / bpPerPx
        const r2s = (bounds.maxEnd - regionStart) / bpPerPx
        // Use orange for chains with supplementary alignments
        const lineColor = hasSupplementary
          ? strokeColor.color_supplementary
          : getConnectingLineColor(configTheme)
        lineToCtx(r1s, lineY, r2s, lineY, ctx, lineColor)
      }
    }

    // First pass: draw all feature shapes
    const layoutFeats: typeof chain = []
    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const featRefName = feat.get('refName')
      const featStart = feat.get('start')
      const featEnd = feat.get('end')

      if (!featureOverlapsRegion(featRefName, featStart, featEnd, region)) {
        continue
      }

      const { xPos, width } = calculateFeaturePositionPx(
        featStart,
        featEnd,
        regionStart,
        region.end,
        bpPerPx,
      )

      layoutFeats.push(feat)

      // Use supplementary color for entire chain if it has supplementary alignments
      const [featFill, featStroke] = hasSupplementary
        ? [fillColor.color_supplementary, strokeColor.color_supplementary]
        : [pairedFill, pairedStroke]

      renderFeatureShape({
        ctx,
        xPos,
        yPos: chainY,
        width,
        height: featureHeight,
        strand: feat.get('strand'),
        fillStyle: featFill,
        strokeStyle: featStroke,
        renderChevrons,
        colorCtx,
        showOutline,
      })
    }

    // Second pass: draw all mismatches on top
    for (const feat of layoutFeats) {
      const layoutFeat = {
        feature: feat,
        heightPx: featureHeight,
        topPx: chainY,
      }

      renderFeatureMismatchesAndModifications({
        ctx,
        feat,
        layoutFeat,
        region,
        regionStartPx,
        bpPerPx,
        canvasWidth,
        colorBy,
        visibleModifications,
        mismatchConfig,
        allCoords,
        allItems,
      })
    }
    // Reset cached fillStyle since mismatch rendering changes ctx.fillStyle
    colorCtx.lastFillStyle = ''
    checkStopToken2(lastCheck)
  }

  return { coords: allCoords, items: allItems }
}
