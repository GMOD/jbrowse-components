import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import {
  calculateFeaturePositionPx,
  featureOverlapsRegion,
  getChainBoundsOnRef,
  getConnectingLineColor,
  getMismatchRenderingConfig,
  getStrandColorKey,
  renderFeatureMismatchesAndModifications,
  renderFeatureShape,
} from './drawChainsUtil.ts'
import { lineToCtx } from '../shared/canvasUtils.ts'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color.ts'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand.ts'

import type { MismatchData } from './drawChainsUtil.ts'
import type { ComputedChain } from './drawFeatsCommon.ts'
import type {
  ChainData,
  ColorBy,
  ModificationTypeWithColor,
} from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LastStopTokenCheck } from '@jbrowse/core/util'
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
  stopTokenCheck,
  hideSmallIndels,
  hideMismatches,
  hideLargeIndels,
  showOutline,
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
  stopTokenCheck?: LastStopTokenCheck
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

  const allCoords: MismatchData['coords'] = []
  const allItems: MismatchData['items'] = []

  for (const computedChain of computedChains) {
    checkStopToken2(stopTokenCheck)
    const { id, chain, isPairedEnd, nonSupplementary } = computedChain

    if (isPairedEnd) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    if (!isSingleton) {
      const bounds = getChainBoundsOnRef(chain, region.refName)
      if (
        bounds &&
        bounds.minStart < region.end &&
        bounds.maxEnd > region.start
      ) {
        const firstPx = (bounds.minStart - regionStart) / bpPerPx
        const lastPx = (bounds.maxEnd - regionStart) / bpPerPx
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          firstPx,
          lineY,
          lastPx,
          lineY,
          ctx,
          getConnectingLineColor(configTheme),
        )
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

      layoutFeats.push(feat)

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
  }

  return {
    coords: allCoords,
    items: allItems,
  }
}
