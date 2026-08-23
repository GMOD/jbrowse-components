import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import {
  LGV_HEADER_HEIGHT_VAR,
  VIEW_HEADER_HEIGHT_VAR,
} from '@jbrowse/core/util/hooks'

import { SCALE_BAR_HEIGHT } from './consts.ts'

/**
 * Where the sticky boxes below the view's chrome pin, as CSS rather than as a
 * pixel sum.
 *
 * The model's `rubberbandTop` / `pinnedTracksTop` answer the same question in
 * numbers, and still have to — `height`, `getTrackYOffset` and the SVG export
 * have no DOM to read. But the numbers are nominal. Both boxes above are now
 * minimum-height, since pinning them to their constants clipped their content
 * at a larger root font size, and one of them is briefly absent during a slow
 * load. Anything positioning against them in the DOM reads what they publish
 * and keeps the constant only as the fallback for the first frame.
 */
export function stickyChromeTops({
  stickyViewHeaders,
  headerHeight,
}: {
  stickyViewHeaders: boolean
  headerHeight: number
}) {
  // `scalebar` is undefined rather than 0 when the chrome does not pin: its
  // readers use that to stay in flow. A pinned *track* block pins either way —
  // pinning tracks is its own feature — so it always has a top, and with no
  // chrome above it that top is the container's own edge.
  const scalebar = stickyViewHeaders
    ? `calc(var(${VIEW_HEADER_HEIGHT_VAR}, ${VIEW_HEADER_HEIGHT}px) + var(${LGV_HEADER_HEIGHT_VAR}, ${headerHeight}px))`
    : undefined
  return {
    scalebar,
    pinnedTracks: scalebar
      ? `calc(${scalebar} + ${SCALE_BAR_HEIGHT}px)`
      : '0px',
  }
}
