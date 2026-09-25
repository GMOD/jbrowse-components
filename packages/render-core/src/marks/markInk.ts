import { canvasWideBlock } from '../renderBlock.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { InkRect, Mark, MarkFrame } from './types.ts'

/** One instance of one mark in a display's list, as a highlight names it. */
export interface MarkInstance {
  mark: number
  index: number
}

function clippedTo(r: InkRect, x0: number, x1: number): InkRect | undefined {
  const left = Math.max(r.left, x0)
  const right = Math.min(r.left + r.width, x1)
  return right >= left
    ? { left, top: r.top, width: right - left, height: r.height }
    : undefined
}

/**
 * The boxes a set of instances painted this frame: each mark's `ink` for the
 * instances a display names in each region, clipped to the block's column the
 * way the painter was, or to the canvas for a mark spanning the view, asked
 * over `regionKeys` (the blocks' own by default). What a highlight guide
 * draws, so a display says WHICH instances are lit and nothing about where
 * they are.
 */
export function inkOfInstances<TRegion, TState extends MarkFrame>(
  marks: readonly Mark<TRegion, TState>[],
  blocks: readonly RenderBlock[],
  regionOf: (displayedRegionIndex: number) => TRegion | undefined,
  state: TState,
  instancesOf: (
    displayedRegionIndex: number,
  ) => Iterable<MarkInstance> | undefined,
  regionKeys?: Iterable<number>,
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
      const m = marks[mark]
      const r = m && !m.spansView && m.ink?.(region, block, state, index)
      const clipped = r && clippedTo(r, x0, x1)
      if (clipped) {
        rects.push(clipped)
      }
    }
  }
  if (marks.some(m => m.spansView)) {
    for (const key of regionKeys ?? blocks.map(b => b.displayedRegionIndex)) {
      const region = regionOf(key)
      const instances = region && instancesOf(key)
      if (!instances) {
        continue
      }
      const block = canvasWideBlock(key, state.canvasWidth)
      for (const { mark, index } of instances) {
        const m = marks[mark]
        const r = m?.spansView && m.ink?.(region, block, state, index)
        const clipped = r && clippedTo(r, 0, state.canvasWidth)
        if (clipped) {
          rects.push(clipped)
        }
      }
    }
  }
  return rects
}
