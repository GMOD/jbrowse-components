import {
  bufferedVisibleRegionsOf,
  contentRightEdgePx,
} from '@jbrowse/display-kit/regionHost'

import { MINIMUM_BLOCK_WIDTH } from './consts.ts'
import { lgvChromeOf } from './staticChrome.ts'
import { visibleRegionsOf } from './visibleRegions.ts'

import type { Region } from '@jbrowse/core/util/types'

/**
 * A linear genome view's frame as a plain object: what a display reads off
 * its view to fetch, scale and draw, for regions laid end to end across
 * `width` px. `windowStartBp` and `windowWidthBp` are the two numbers the view
 * stores its viewport as, in the linearized bp of `displayedRegions`; unset,
 * the window is every displayed region, edge to edge. A static frame has
 * settled, so its coarse blocks are its live ones, and it draws no track
 * outline. It carries what the view's SVG chrome reads too, so it frames a
 * whole export (`staticLgvSvg`); `id` is what the chrome's SVG ids are built
 * from, by default what a session's first view builds them from.
 */
export function staticLgvFrame({
  id = '0',
  displayedRegions,
  width,
  windowStartBp = 0,
  windowWidthBp = displayedRegions.reduce((sum, r) => sum + r.end - r.start, 0),
}: {
  id?: string
  displayedRegions: Region[]
  width: number
  windowStartBp?: number
  windowWidthBp?: number
}) {
  const bpPerPx = windowWidthBp / width
  const offsetPx = windowStartBp / bpPerPx
  const chrome = lgvChromeOf({
    offsetPx,
    width,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth: MINIMUM_BLOCK_WIDTH,
  })
  const { contentBlocks } = chrome.dynamicBlocks
  const visibleRegions = visibleRegionsOf(contentBlocks, offsetPx)
  return {
    ...chrome,
    id,
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
