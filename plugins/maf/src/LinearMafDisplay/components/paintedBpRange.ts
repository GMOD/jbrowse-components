import type { BlockClip } from '@jbrowse/render-core/canvas2dUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The genomic range a render block can actually paint, widened by one pixel's
 * worth of bp.
 *
 * Every MAF Canvas2D pass walks the *buffered* region's blocks — half a screen
 * of extra data each side — while the render block it is painting into covers
 * only the visible span. Roughly half of what it walks is therefore discarded
 * by the scissor clamp afterwards, once per block per frame. Testing a MAF
 * block's `[startBp, endBp)` against this range first skips that work before it
 * is done rather than after.
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
  return { bpLo: block.start - slack, bpHi: block.end + slack }
}
