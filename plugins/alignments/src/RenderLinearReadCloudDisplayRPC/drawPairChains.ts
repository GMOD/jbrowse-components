import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import {
  CONNECTING_LINE_COLOR,
  calculateFeaturePositionPx,
  chainIsPairedEnd,
  collectNonSupplementary,
  featureOverlapsRegion,
  getMismatchRenderingConfig,
  renderFeatureMismatchesAndModifications,
  renderFeatureShape,
} from './drawChainsUtil'
import { lineToCtx } from '../shared/canvasUtils'
import { getPairedColor } from '../shared/color'

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
}): MismatchData {
  const mismatchConfig = getMismatchRenderingConfig(
    ctx,
    config,
    configTheme,
    colorBy,
    { hideSmallIndels, hideMismatches },
  )
  const canvasWidth = region.widthPx
  const regionStart = region.start
  const colorCtx = { lastFillStyle: '' }

  const allCoords: MismatchData['coords'] = []
  const allItems: MismatchData['items'] = []
  const lastCheck = createStopTokenChecker(stopToken)

  for (const computedChain of computedChains) {
    checkStopToken2(lastCheck)
    const { id, chain } = computedChain

    if (!chainIsPairedEnd(chain)) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const nonSupplementary = collectNonSupplementary(chain)
    const hasBothMates = nonSupplementary.length === 2

    // Get colors for this read pair/singleton
    const feat = nonSupplementary[0] || chain[0]!
    const [pairedFill, pairedStroke] = getPairedColor({
      type,
      v0: feat,
      stats: chainData.stats,
    }) || ['lightgrey', '#888']

    const lineY = chainY + featureHeight / 2

    // Draw connecting line spanning all features in chain (including supplementary)
    if (hasBothMates) {
      // Find min/max coordinates across all features on this reference
      let minStart = Number.MAX_VALUE
      let maxEnd = Number.MIN_VALUE

      for (let i = 0; i < chain.length; i++) {
        const f = chain[i]!
        if (f.get('refName') === region.refName) {
          minStart = Math.min(minStart, f.get('start'))
          maxEnd = Math.max(maxEnd, f.get('end'))
        }
      }

      if (
        minStart !== Number.MAX_VALUE &&
        minStart < region.end &&
        maxEnd > region.start
      ) {
        const r1s = (minStart - regionStart) / bpPerPx
        const r2s = (maxEnd - regionStart) / bpPerPx
        lineToCtx(r1s, lineY, r2s, lineY, ctx, CONNECTING_LINE_COLOR)
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

      const { xPos, width } = calculateFeaturePositionPx(
        featStart,
        featEnd,
        regionStart,
        region.end,
        bpPerPx,
      )

      const layoutFeat = {
        feature: feat,
        heightPx: featureHeight,
        topPx: chainY,
      }

      renderFeatureShape({
        ctx,
        xPos,
        yPos: chainY,
        width,
        height: featureHeight,
        strand: feat.get('strand'),
        fillStyle: pairedFill,
        strokeStyle: pairedStroke,
        renderChevrons,
        colorCtx,
      })

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
    checkStopToken2(lastCheck)
  }

  return { coords: allCoords, items: allItems }
}
