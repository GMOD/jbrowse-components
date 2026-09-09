import type { RenderBlock } from '../renderBlock.ts'
import type { InkRect, Mark, MarkFrame } from './types.ts'

/** One instance of one mark in a display's list, as a highlight names it. */
export interface MarkInstance {
  mark: number
  index: number
}

/**
 * The boxes a set of instances painted this frame: each mark's `ink` for the
 * instances a display names in each region, clipped to the block's column the
 * way the painter was. What a highlight guide draws, so a display says WHICH
 * instances are lit and nothing about where they are.
 */
export function inkOfInstances<TRegion, TState extends MarkFrame>(
  marks: readonly Mark<TRegion, TState>[],
  blocks: readonly RenderBlock[],
  regionOf: (displayedRegionIndex: number) => TRegion | undefined,
  state: TState,
  instancesOf: (
    displayedRegionIndex: number,
  ) => Iterable<MarkInstance> | undefined,
): InkRect[] {
  const rects: InkRect[] = []
  for (const block of blocks) {
    const region = regionOf(block.displayedRegionIndex)
    const instances = region && instancesOf(block.displayedRegionIndex)
    if (!instances) {
      continue
    }
    const x0 = Math.min(block.screenStartPx, block.screenEndPx)
    const x1 = Math.max(block.screenStartPx, block.screenEndPx)
    for (const { mark, index } of instances) {
      const r = marks[mark]?.ink?.(region, block, state, index)
      if (r) {
        const left = Math.max(r.left, x0)
        const right = Math.min(r.left + r.width, x1)
        if (right >= left) {
          rects.push({
            left,
            top: r.top,
            width: right - left,
            height: r.height,
          })
        }
      }
    }
  }
  return rects
}
