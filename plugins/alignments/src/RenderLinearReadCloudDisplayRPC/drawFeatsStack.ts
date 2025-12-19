import { PileupLayout } from '@jbrowse/core/util/layouts'

import type { ComputedChain } from './drawFeatsCommon'

/**
 * Calculate Y-offsets using PileupLayout for stack mode
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
