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
  getStrandColorKey,
  lineIntersectsRegion,
  renderFeatureMismatchesAndModifications,
  renderFeatureShape,
} from './drawChainsUtil'
import { lineToCtx } from '../shared/canvasUtils'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand'

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
  regionStartPx,
  bpPerPx,
  colorBy,
  visibleModifications,
  stopToken,
  hideSmallIndels,
  hideMismatches,
}: {
  ctx: CanvasRenderingContext2D
  chainData: ChainData
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  computedChains: ComputedChain[]
  flipStrandLongReadChains: boolean
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

    if (chainIsPairedEnd(chain)) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const nonSupplementary = collectNonSupplementary(chain)
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    // Check if the line segment intersects the region (not just if features overlap)
    if (!isSingleton) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstRefName = firstFeat.get('refName')
      const lastRefName = lastFeat.get('refName')
      const firstStart = firstFeat.get('start')
      const lastEnd = lastFeat.get('end')

      if (
        lineIntersectsRegion(
          firstRefName,
          lastRefName,
          firstStart,
          lastEnd,
          region,
        )
      ) {
        const firstPx = (firstStart - regionStart) / bpPerPx
        const lastPx = (lastEnd - regionStart) / bpPerPx
        const lineY = chainY + featureHeight / 2
        lineToCtx(firstPx, lineY, lastPx, lineY, ctx, CONNECTING_LINE_COLOR)
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
        strand: effectiveStrand,
        fillStyle: featureFill,
        strokeStyle: featureStroke,
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
  }

  return {
    coords: allCoords,
    items: allItems,
  }
}
