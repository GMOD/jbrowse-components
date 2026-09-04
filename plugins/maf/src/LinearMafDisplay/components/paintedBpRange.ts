import { bpCull } from './visibleRegionGeometry.ts'

import type { BlockClip } from '@jbrowse/render-core/canvas2dUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The `bpCull` a render block can actually paint into, widened by one pixel's
 * worth of bp — the Canvas2D twin of the one `eachVisibleRegion` yields, which
 * bounds against a visible region instead.
 *
 * The padding matters: `clampBlockScissor` floors/ceils the block's screen
 * span, so a base just outside the block can still land on its edge pixel.
 * `[block.start, block.end)` is the same interval whichever way the block is
 * oriented, so there is no reversed case.
 *
 * A conservative bound is the point — the per-position clamp inside each walk
 * stays the authority on what paints, so slack costs a little work and can
 * never change the picture.
 */
export function paintedBpRange(block: RenderBlock, clip: BlockClip) {
  const slack = Math.ceil(clip.bpLength / clip.fullBlockWidth) + 1
  return bpCull(block.start - slack, block.end + slack)
}
