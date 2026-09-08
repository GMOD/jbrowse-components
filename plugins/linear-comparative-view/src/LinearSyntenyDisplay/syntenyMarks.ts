import { syntenyMarkBlock, syntenyRibbonMarks } from './syntenyRibbonMarks.ts'

import type {
  SyntenyCell,
  SyntenyRenderState,
} from './syntenyRenderingBackendTypes.ts'

/**
 * One level's band: every track's ribbons plus the outline of whichever ribbon
 * is selected, over the four synteny passes. This is the whole of what the band
 * used to spell as a `GpuSyntenyRenderer`, a `Canvas2DSyntenyRenderer`, a pass
 * list and a lazy per-mode buffer cache.
 */
export const SYNTENY_MARKS = syntenyRibbonMarks<
  SyntenyCell,
  SyntenyRenderState
>({
  ribbons: cell => (cell.kind === 'ribbons' ? cell.data : undefined),
  outline: cell => (cell.kind === 'outline' ? cell : undefined),
  params: (state, cell, block) => {
    const track = state.perTrack.get(block.displayedRegionIndex)
    return (
      track && {
        track,
        base0: cell.data.base0,
        base1: cell.data.base1,
        overdrawPx: state.overdrawPx,
        groundColor: state.groundColor,
      }
    )
  },
})

/**
 * One canvas-wide block per cell, in the map's insertion order — so a track's
 * outline draws over its own fill and a later track over an earlier one. An
 * empty list is a real frame, not a skip: the frame clears before drawing, so
 * painting zero cells is what wipes a departed track's ribbons.
 */
export function syntenyMarkBlocks(keys: Iterable<number>, canvasWidth: number) {
  return [...keys].map(key => syntenyMarkBlock(key, canvasWidth))
}
