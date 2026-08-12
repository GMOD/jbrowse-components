import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Put `view` on `span`, synchronously and without touching its displayed
 * regions.
 *
 * `setNewView`'s two halves rather than `moveTo`, which is what the one-shot
 * paths use, for one specific reason: `moveTo` FLUSHES the view's coarse
 * blocks, on the argument that a discrete jump has nothing to coalesce. Per
 * frame that stops being true — it would republish the followed row's debounced
 * window sixty times a second, and the exact pass tracks exactly that, so every
 * frame of a drag would wake an RPC. Pan and zoom deliberately do not flush,
 * and this is pan and zoom.
 *
 * The offset is computed against the view's OWN bpPerPx after the zoom rather
 * than the requested one, because `zoomTo` clamps to the view's limits and an
 * offset in the unclamped units lands somewhere else entirely.
 *
 * False when the span is not inside the displayed regions at all, which is the
 * caller's signal that a real navigation is needed instead.
 */
export function positionViewOnSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  const a = cumulativeBp(view, span.refName, span.start)
  const b = cumulativeBp(view, span.refName, span.end)
  if (a === undefined || b === undefined || view.width <= 0) {
    return false
  }
  const [lo, hi] = a <= b ? [a, b] : [b, a]
  if (hi <= lo) {
    return false
  }
  view.zoomTo((hi - lo) / view.width)
  view.scrollTo(lo / view.bpPerPx)
  return true
}

/**
 * A coordinate's distance in bp from the left edge of the displayed regions.
 *
 * The unit `offsetPx` is in, divided by bpPerPx: LGV's offset space is exactly
 * `bp / bpPerPx`, since inter-region padding contributes no pixels. `bpToPx`
 * answers the same question but bakes in the view's CURRENT bpPerPx, which is
 * the wrong one when the caller is about to change it.
 *
 * `undefined` when no displayed region holds the coord.
 */
function cumulativeBp(
  view: LinearGenomeViewModel,
  refName: string,
  coord: number,
) {
  let bpSoFar = 0
  for (const r of view.displayedRegions) {
    if (r.refName === refName && coord >= r.start && coord <= r.end) {
      return bpSoFar + bpOffsetInRegion(r, coord)
    }
    bpSoFar += r.end - r.start
  }
  return undefined
}
