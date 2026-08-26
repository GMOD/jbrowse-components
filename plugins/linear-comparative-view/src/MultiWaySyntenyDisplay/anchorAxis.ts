import { clipToDisplayedRegions } from '@jbrowse/core/util/Base1DUtils'

import type { Span } from './layoutMultiWay.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * One anchor-assembly bp interval on the view's own axis, as a px pair in the
 * interval's OWN order — start end first, so a horizontally flipped view hands
 * the ribbons the crossed pair it is drawing. The anchor lane's counterpart to
 * `frameSpan`, and the same clipping rule.
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
export function axisSpan(
  view: LinearGenomeViewModel,
  refName: string,
  start: number,
  end: number,
): Span | undefined {
  const clipped = clipToDisplayedRegions(view, { refName, start, end })
  if (!clipped) {
    return undefined
  }
  const a = view.bpToPx({ refName, coord: clipped.start })
  const b = view.bpToPx({ refName, coord: clipped.end })
  return a === undefined || b === undefined
    ? undefined
    : [a.offsetPx - view.offsetPx, b.offsetPx - view.offsetPx]
}
