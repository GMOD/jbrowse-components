import {
  bpToOffset,
  compareBpOffsets,
  moveTo,
} from '@jbrowse/core/util/Base1DUtils'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * Put `view` on every span at once — the interval of its own layout that runs
 * from the leftmost of them to the rightmost — synchronously and without
 * touching its displayed regions.
 *
 * SPANS ON DIFFERENT CONTIGS ARE A PLACE HERE, where one `ResolvedSpan` cannot
 * name one: the row lays its `displayedRegions` end to end, so an interval of
 * that layout is exactly what `moveTo` takes. This is what lets an anchor row
 * showing a whole genome place its neighbour on a whole genome rather than on
 * whichever single contig won a vote.
 *
 * Base1DUtils' `moveTo`, NOT the view action of the same name, which wraps it
 * and then flushes the view's coarse blocks — sixty times a second that would
 * wake the exact pass, which tracks them, into an RPC per frame.
 *
 * A span outside the displayed regions is SKIPPED rather than fatal: the row is
 * showing another contig, and changing that is a real navigation the exact pass
 * is already on its way to do. False when nothing landed at all.
 */
export function positionViewOnSpans(
  view: LinearGenomeViewModel,
  spans: ResolvedSpan[],
) {
  const { displayedRegions } = view
  let lo: ReturnType<typeof bpToOffset>
  let hi: ReturnType<typeof bpToOffset>
  for (const { refName, start, end } of spans) {
    for (const coord of [start, end]) {
      const at = bpToOffset({ refName, coord, displayedRegions })
      // min and max rather than a sorted pair, since a reversed region puts a
      // span's end left of its start and moveTo computes a negative bpPerPx
      // from a backwards pair rather than refusing
      if (at) {
        lo = !lo || compareBpOffsets(at, lo) < 0 ? at : lo
        hi = !hi || compareBpOffsets(at, hi) > 0 ? at : hi
      }
    }
  }
  if (!lo || !hi || view.width <= 0 || compareBpOffsets(lo, hi) === 0) {
    return false
  }
  moveTo(view, lo, hi)
  return true
}

/**
 * Put `view` on one span. The single-contig case of
 * {@link positionViewOnSpans}.
 */
export function positionViewOnSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  return positionViewOnSpans(view, [span])
}
