import {
  bpToOffset,
  compareBpOffsets,
  moveTo,
} from '@jbrowse/core/util/Base1DUtils'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Put `view` on `span`, synchronously and without touching its displayed
 * regions.
 *
 * Base1DUtils' `moveTo` rather than the view ACTION of the same name, which
 * wraps it and then FLUSHES the view's coarse blocks, on the argument that a
 * discrete jump has nothing to coalesce. Per frame that stops being true — it
 * would republish the followed row's debounced window sixty times a second, and
 * the exact pass tracks exactly that, so every frame of a drag would wake an
 * RPC. Pan and zoom deliberately do not flush, and this is pan and zoom.
 *
 * The zoom-then-scroll pair underneath has to measure its offset against the
 * bpPerPx `zoomTo` LANDED on rather than the one asked for, and re-centre when
 * those differ. Getting only the first half of that right left the row flush
 * against the span's left edge wherever the clamp bit, half a screen from where
 * the exact pass puts it through `navToLocString` — which is the same `moveTo`.
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
  const a = bpToOffset({ refName, coord: span.start, displayedRegions })
  const b = bpToOffset({ refName, coord: span.end, displayedRegions })
  if (!a || !b || view.width <= 0) {
    return false
  }
  // a reversed region puts the span's end left of its start, and moveTo
  // computes a negative bpPerPx from a backwards pair rather than refusing
  const [lo, hi] = compareBpOffsets(a, b) <= 0 ? [a, b] : [b, a]
  if (compareBpOffsets(lo, hi) === 0) {
    return false
  }
  moveTo(view, lo, hi)
  return true
}
