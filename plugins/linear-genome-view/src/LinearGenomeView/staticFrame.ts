import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { contentRightEdgePx } from '@jbrowse/display-kit/regionHost'

import { MINIMUM_BLOCK_WIDTH } from './consts.ts'
import { bufferedVisibleRegionsOf, visibleRegionsOf } from './visibleRegions.ts'

import type { Region } from '@jbrowse/core/util/types'

/**
 * A linear genome view's frame as a plain object: what a display reads off
 * its view to fetch, scale and draw, for regions laid end to end across
 * `width` px. `windowStartBp` and `windowWidthBp` are the two numbers the view
 * stores its viewport as, in the linearized bp of `displayedRegions`; unset,
 * the window is every displayed region, edge to edge. A static frame has
 * settled, so its coarse blocks are its live ones, and it draws no track
 * outline.
 */
export function staticLgvFrame({
  displayedRegions,
  width,
  windowStartBp = 0,
  windowWidthBp = displayedRegions.reduce((sum, r) => sum + r.end - r.start, 0),
}: {
  displayedRegions: Region[]
  width: number
  windowStartBp?: number
  windowWidthBp?: number
}) {
  const bpPerPx = windowWidthBp / width
  const offsetPx = windowStartBp / bpPerPx
  const { contentBlocks } = calculateDynamicBlocks({
    offsetPx,
    width,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth: MINIMUM_BLOCK_WIDTH,
  })
  const visibleRegions = visibleRegionsOf(contentBlocks, offsetPx)
  return {
    initialized: true,
    width,
    trackWidthPx: width,
    bpPerPx,
    coarseBpPerPx: bpPerPx,
    offsetPx,
    displayedRegions,
    visibleRegions,
    settledDynamicBlocks: contentBlocks,
    bufferedVisibleRegions: bufferedVisibleRegionsOf({
      visibleRegions,
      displayedRegions,
      width,
      bpPerPx,
    }),
    contentRightEdgePx: contentRightEdgePx(visibleRegions, width),
  }
}

export type StaticLgvFrame = ReturnType<typeof staticLgvFrame>
