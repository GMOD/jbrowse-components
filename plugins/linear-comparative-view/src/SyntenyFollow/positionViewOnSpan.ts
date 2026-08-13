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
 * Base1DUtils' `moveTo`, NOT the view action of the same name, which wraps it
 * and then flushes the view's coarse blocks — sixty times a second that would
 * wake the exact pass, which tracks them, into an RPC per frame.
 *
 * False when the span is outside the displayed regions: the row is showing
 * another contig, and changing that is a real navigation the exact pass is
 * already on its way to do.
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
