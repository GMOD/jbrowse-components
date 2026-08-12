import { bpToCumulativeBp } from '@jbrowse/core/util/Base1DUtils'

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
 * False when the span is not inside the displayed regions at all — the followed
 * row is showing one contig and the follow has mapped onto another. The frame
 * pass leaves the row alone there rather than acting on it: changing what a row
 * displays is a real navigation, and the exact pass's `navToLocString` is
 * already on its way to do exactly that.
 */
export function positionViewOnSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  const { refName } = span
  const { displayedRegions } = view
  const a = bpToCumulativeBp({ refName, coord: span.start, displayedRegions })
  const b = bpToCumulativeBp({ refName, coord: span.end, displayedRegions })
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
