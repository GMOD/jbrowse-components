import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import {
  chainIsPairedEnd,
  collectNonSupplementary,
  featureOverlapsRegion,
  getMismatchRenderingConfig,
  renderFeatureMismatchesAndModifications,
} from './drawChainsUtil'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { getPairedColor } from '../shared/color'
import { CHEVRON_WIDTH } from '../shared/util'

import type { MismatchData } from './drawChainsUtil'
import type { ComputedChain } from './drawFeatsCommon'
import type { FlatbushItem } from '../PileupRenderer/types'
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
  let lastColor = ''

  const allCoords: number[] = []
  const allItems: FlatbushItem[] = []
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

    // Draw connecting line for pairs with both mates visible
    // Check if the line segment intersects the region (not just if features overlap)
    if (hasBothMates) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!

      const v0RefName = v0.get('refName')
      const v1RefName = v1.get('refName')
      const v0Start = v0.get('start')
      const v1Start = v1.get('start')

      // Line intersects region if both mates are on same refName and line spans the region
      const bothOnRefName =
        v0RefName === region.refName && v1RefName === region.refName
      const lineMin = Math.min(v0Start, v1Start)
      const lineMax = Math.max(v0Start, v1Start)
      const lineIntersectsRegion =
        bothOnRefName && lineMin < region.end && lineMax > regionStart

      if (lineIntersectsRegion) {
        const r1s = (v0Start - regionStart) / bpPerPx
        const r2s = (v1Start - regionStart) / bpPerPx
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
      const clippedEnd = Math.min(featEnd, region.end)
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
          feat.get('strand'),
          pairedFill,
          CHEVRON_WIDTH,
          pairedStroke,
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

        if (pairedFill && lastColor !== pairedFill) {
          ctx.fillStyle = pairedFill
          lastColor = pairedFill
        }

        ctx.fillRect(drawX, drawY, drawWidth, featureHeight)
        strokeRectCtx(drawX, drawY, drawWidth, featureHeight, ctx, pairedStroke)
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
    checkStopToken2(lastCheck)
  }

  return { coords: allCoords, items: allItems }
}
