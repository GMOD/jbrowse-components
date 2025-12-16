import { getConf } from '@jbrowse/core/configuration'
import { PileupLayout } from '@jbrowse/core/util/layouts'

import { drawFeatsCommon } from './drawFeatsCommon'

import type { ComputedChain } from './drawFeatsCommon'
import type { LinearReadCloudDisplayModel } from './model'

/**
 * Core utility function to calculate Y-offsets using PileupLayout
 */
export function calculateStackYOffsetsUtil(
  computedChains: ComputedChain[],
  featureHeight: number,
  noSpacing: boolean,
  maxHeight: number,
) {
  const layout = new PileupLayout({
    featureHeight,
    spacing: noSpacing ? 0 : 2,
    maxHeight,
  })

  const chainYOffsets = new Map<string, number>()
  for (const { id, minX, maxX } of computedChains) {
    const topPx = layout.addRect(id, minX, maxX, featureHeight)
    if (topPx !== null) {
      chainYOffsets.set(id, topPx)
    }
  }

  return { chainYOffsets, layoutHeight: layout.getTotalHeight() }
}

export function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
) {
  const featureHeight = self.featureHeight ?? getConf(self, 'featureHeight')
  const noSpacing = self.noSpacing ?? false
  const maxHeight = self.trackMaxHeight ?? 1200

  drawFeatsCommon({
    self,
    ctx,
    canvasWidth,
    calculateYOffsets: computedChains =>
      calculateStackYOffsetsUtil(computedChains, featureHeight, noSpacing, maxHeight),
  })
}
