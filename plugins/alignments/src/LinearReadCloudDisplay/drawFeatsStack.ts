import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'

import { drawFeatsCommon } from './drawFeatsCommon'

import type { ComputedChain } from './drawFeatsCommon'
import type { LinearReadCloudDisplayModel } from './model'
import type { ReducedFeature } from '../shared/fetchChains'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface LayoutData {
  feat: ReducedFeature
  fill: string
  stroke: string
  distance: number
}

/**
 * Calculate Y-offsets using GranularRectLayout for stacking
 */
function calculateStackYOffsets(
  computedChains: ComputedChain[],
  self: LinearReadCloudDisplayModel,
  _view: LGV,
  featureHeight: number,
) {
  const noSpacing = self.noSpacing ?? false
  const maxHeight = self.trackMaxHeight ?? 1200

  const layout = new GranularRectLayout<LayoutData>({
    pitchX: 1,
    pitchY: 1,
    maxHeight,
  })

  // Add small padding between rows (unless noSpacing is enabled)
  const layoutPadding = noSpacing ? 0 : 1

  // First pass: add all dummy chain rectangles to the layout
  for (const { id, minX, maxX, chain } of computedChains) {
    layout.addRect(id, minX, maxX, featureHeight + layoutPadding, {
      feat: chain[0]!, // Use first feature as a placeholder for layout data
      fill: 'transparent',
      stroke: 'transparent',
      distance: maxX - minX,
    })
  }

  // Second pass: retrieve laid-out rectangles and populate chainYOffsets
  const chainYOffsets = new Map<string, number>()
  for (const [id, rect] of layout.getRectangles()) {
    const top = rect[1]
    chainYOffsets.set(id, top) // Store the Y-offset (top) for the chain
  }

  return { chainYOffsets, layoutHeight: layout.getTotalHeight() }
}

export function drawFeats(
  self: LinearReadCloudDisplayModel,
  ctx: CanvasRenderingContext2D,
) {
  drawFeatsCommon(self, ctx, calculateStackYOffsets)
}
