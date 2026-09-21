import {
  bpToOffset,
  compareBpOffsets,
  moveTo,
} from '@jbrowse/core/util/Base1DUtils'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/**
 * The interval of the row's layout from the leftmost of these spans to the
 * rightmost, skipping a span outside its displayed regions. `spreadCoverage`
 * measures against the same bounds this places.
 */
export function spanBounds(
  displayedRegions: LinearGenomeViewModel['displayedRegions'],
  spans: ResolvedSpan[],
) {
  let lo: ReturnType<typeof bpToOffset>
  let hi: ReturnType<typeof bpToOffset>
  for (const { refName, start, end } of spans) {
    for (const coord of [start, end]) {
      const at = bpToOffset({ refName, coord, displayedRegions })
      // a reversed region puts a span's end left of its start
      if (at) {
        lo = !lo || compareBpOffsets(at, lo) < 0 ? at : lo
        hi = !hi || compareBpOffsets(at, hi) > 0 ? at : hi
      }
    }
  }
  return lo && hi ? { lo, hi } : undefined
}

/**
 * Put `view` on every span at once without touching its displayed regions.
 * Base1DUtils' `moveTo`, not the view action, which flushes the coarse blocks
 * and so would cost an RPC per frame. `minBpPerPx` widens a narrower interval
 * around its centre. False when nothing landed.
 */
export function positionViewOnSpans(
  view: LinearGenomeViewModel,
  spans: ResolvedSpan[],
  minBpPerPx?: number,
) {
  const bounds = spanBounds(view.displayedRegions, spans)
  if (
    !bounds ||
    view.width <= 0 ||
    compareBpOffsets(bounds.lo, bounds.hi) === 0
  ) {
    return false
  }
  moveTo(view, bounds.lo, bounds.hi, minBpPerPx)
  return true
}

export function positionViewOnSpan(
  view: LinearGenomeViewModel,
  span: ResolvedSpan,
) {
  return positionViewOnSpans(view, [span])
}
