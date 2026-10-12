import { bpCull } from './visibleRegionGeometry.ts'

import type { BlockClip } from '@jbrowse/render-core/canvas2dUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The `bpCull` a render block can paint into, widened by `slackPx` (one pixel
 * by default) of bp: the Canvas2D twin of the one `eachVisibleRegion` yields.
 * The slack covers `clampBlockScissor`'s floor/ceil of the block's screen span.
 * `[block.start, block.end)` has no reversed case. The per-position clamp
 * inside each walk stays the authority on what paints.
 */
export function paintedBpRange(
  block: RenderBlock,
  clip: BlockClip,
  slackPx = 1,
) {
  const slack = Math.ceil((slackPx * clip.bpLength) / clip.fullBlockWidth) + 1
  return bpCull(block.start - slack, block.end + slack)
}
