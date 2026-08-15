import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// A tolerance rather than an equality test because navToLocString fits the span
// to the pane rather than landing on it exactly, so the row never reports back
// the numbers it was given and every wake would renavigate it by a few more bp.
const ALREADY_THERE_FRACTION = 0.02

/**
 * Whether the moving row is already where the follow would send it, so the
 * exact pass can stop rather than navigate.
 *
 * `shown` is where the row ACTUALLY is, not what the follow last asked for:
 * they come apart when the user nudges a followed row by hand.
 *
 * `minWidthBp` is `minBpPerPx * width` — THE NARROWEST WINDOW THE MOVING VIEW
 * CAN SHOW, and it is what makes this terminate. A view asked for a span below
 * its zoom floor centres and widens it instead, so the row reports back a
 * window the span merely sits inside; on the numbers alone that is never
 * "already there", and every wake renavigated to the same place — which flushes
 * the row's coarse blocks and wakes the pass again. A swapped-assembly track
 * spun one core on that indefinitely.
 *
 * It is not only that track. `interpolateFollowSpan` and `followWindowMapping`
 * both clamp their answer up to a base, deliberately, so an interpolation that
 * collapses arrives here one base wide rather than zero and gets past the
 * degenerate check in the caller. Passing 0 keeps the plain comparison.
 */
export function alreadyShowing(
  shown: FollowWindow | undefined,
  span: ResolvedSpan,
  minWidthBp = 0,
) {
  if (!shown || shown.refName !== span.refName) {
    return false
  }
  const slack = Math.max((span.end - span.start) * ALREADY_THERE_FRACTION, 1)
  if (
    Math.abs(shown.start - span.start) <= slack &&
    Math.abs(shown.end - span.end) <= slack
  ) {
    return true
  }
  // Containment rather than a predicted window, since navTo also clamps to the
  // displayed regions — near a contig end the widened window is not centred on
  // the span and its edges cannot be arithmetic'd for. A window no wider than
  // the floor cannot be a row parked somewhere else: the whole-genome view a
  // follow has to correct is orders of magnitude wider.
  return (
    shown.end - shown.start <= minWidthBp + slack &&
    shown.start <= span.start &&
    shown.end >= span.end
  )
}
