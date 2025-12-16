import { PileupLayout } from '@jbrowse/core/util/layouts'

import { drawFeatsCommon } from './drawFeatsCommon'

import type { ComputedChain, DrawFeatsParams } from './drawFeatsCommon'
import type { LinearReadCloudDisplayModel } from './model'

/**
 * Calculate Y-offsets using PileupLayout for stacking (params-based version for RPC)
 */
export function calculateStackYOffsetsCore(
  computedChains: ComputedChain[],
  params: DrawFeatsParams,
  featureHeight: number,
) {
  const noSpacing = params.noSpacing ?? false
  const maxHeight = params.trackMaxHeight ?? 1200

  const layout = new PileupLayout({
    featureHeight,
    spacing: noSpacing ? 0 : 2,
    maxHeight,
  })

  // Sort by minX for PileupLayout's hint optimization
  const sortedChains = [...computedChains].sort((a, b) => a.minX - b.minX)

  // Add all chain rectangles to the layout
  const chainYOffsets = new Map<string, number>()
  for (const { id, minX, maxX } of sortedChains) {
    const topPx = layout.addRect(id, minX, maxX, featureHeight)
    if (topPx !== null) {
      chainYOffsets.set(id, topPx)
    }
  }

  return { chainYOffsets, layoutHeight: layout.getTotalHeight() }
}

/**
 * Calculate Y-offsets using PileupLayout for stacking (model-based version)
 */
function calculateStackYOffsets(
  computedChains: ComputedChain[],
  self: LinearReadCloudDisplayModel,
  featureHeight: number,
) {
  const noSpacing = self.noSpacing ?? false
  const maxHeight = self.trackMaxHeight ?? 1200

  const layout = new PileupLayout({
    featureHeight,
    spacing: noSpacing ? 0 : 2,
    maxHeight,
  })

  // Sort by minX for PileupLayout's hint optimization
  const sortedChains = [...computedChains].sort((a, b) => a.minX - b.minX)

  // Add all chain rectangles to the layout
  const chainYOffsets = new Map<string, number>()
  for (const { id, minX, maxX } of sortedChains) {
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
  drawFeatsCommon({
    self,
    ctx,
    canvasWidth,
    calculateYOffsets: calculateStackYOffsets,
  })
}
