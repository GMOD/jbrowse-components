import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'

import type { AnchorCoord } from './laneDecision.ts'
import type { Span } from './layoutMultiWay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface AxisPlacement {
  /** the view's px for the clipped interval's ends, before the scroll offset, in the interval's own order */
  x1: number
  x2: number
  /** the clipped interval's centre, which is what a lane decision pins to */
  centre: AnchorCoord
}

/**
 * One anchor-assembly bp interval on the view's own axis: the px of its ends
 * in the interval's OWN order — start end first, so a horizontally flipped
 * view hands the ribbons the crossed pair it is drawing — and the centre of
 * what the axis shows of it. The anchor lane's counterpart to `frameSpan`,
 * and the same clipping rule.
 *
 * CLIPPED to the displayed regions, not tested against them. `bpToPx` answers
 * only for a coord INSIDE a region, so an interval straddling a region edge
 * loses BOTH its ends and the caller drops the whole thing: the group's ribbon
 * to the lane below goes missing along with its seed for the lane alignment,
 * while the mate lanes underneath still draw the group, and a gene straddling
 * the edge draws neither half. That is `frameSpan`'s rule on the lane side and
 * `getLayoutHighlightCoords`'s for a bookmark; the anchor axis was the one that
 * still tested.
 */
export function axisPlacement(
  view: LinearGenomeViewModel,
  refName: string,
  start: number,
  end: number,
): AxisPlacement | undefined {
  const clipped = clipToDisplayedRegions(view, { refName, start, end })
  if (!clipped) {
    return undefined
  }
  const a = view.bpToPx({ refName, coord: clipped.start })
  const b = view.bpToPx({ refName, coord: clipped.end })
  return a === undefined || b === undefined
    ? undefined
    : {
        x1: a.offsetPx,
        x2: b.offsetPx,
        centre: { refName, coord: (clipped.start + clipped.end) / 2 },
      }
}

/** the same interval as a px pair relative to `originPx`: what a lane's `spanOf` answers */
export function axisSpan(
  view: LinearGenomeViewModel,
  refName: string,
  start: number,
  end: number,
  originPx = view.offsetPx,
): Span | undefined {
  const placement = axisPlacement(view, refName, start, end)
  return placement && [placement.x1 - originPx, placement.x2 - originPx]
}
