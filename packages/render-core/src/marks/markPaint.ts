import { forEachClippedBlock } from '../canvas2dUtils.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { Mark, MarkContext2D, MarkFrame } from './types.ts'

/**
 * Paint one frame's blocks with a mark list — the Canvas2D half of a
 * declaration, and the SVG export path, since `MarkContext2D` is satisfied by
 * both a real 2D context and the SVG one.
 *
 * Its own module, away from the backend that calls it: an SVG export runs with
 * no backend attached at all (and must, or a headless export would depend on a
 * GPU device having been probed), so the path that draws must not pull the HAL
 * in behind it.
 */
export function paintMarkBlocks<TRegion, TState extends MarkFrame>(
  ctx: MarkContext2D,
  marks: readonly Mark<TRegion, TState>[],
  regions: ReadonlyMap<number, TRegion>,
  blocks: RenderBlock[],
  state: TState,
) {
  forEachClippedBlock(
    ctx,
    blocks,
    state.canvasWidth,
    state.canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (region, block) => {
      for (const mark of marks) {
        mark.paintBlock(ctx, region, block, state)
      }
    },
  )
}
