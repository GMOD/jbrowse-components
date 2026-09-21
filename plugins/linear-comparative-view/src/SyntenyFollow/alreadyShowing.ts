import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// a navigation fits the span to the pane, so the row never reports back the
// exact numbers it was given
const ALREADY_THERE_FRACTION = 0.02

/**
 * Whether the moving row, where it actually is, already shows the span the
 * follow would send it to. `minWidthBp` is the narrowest window the row can
 * show: a span below it is widened around, so containment counts as arrived,
 * or the follow renavigates forever.
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
  // containment, since navTo also clamps to the displayed regions near a
  // contig end
  return (
    shown.end - shown.start <= minWidthBp + slack &&
    shown.start <= span.start &&
    shown.end >= span.end
  )
}
