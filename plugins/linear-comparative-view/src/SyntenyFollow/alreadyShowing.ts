import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// A tolerance rather than an equality test because navToLocString fits the span
// to the pane rather than landing on it exactly, so the row never reports back
// the numbers it was given and every wake would renavigate it by a few more bp.
const ALREADY_THERE_FRACTION = 0.02

// `shown` is where the row ACTUALLY is, not what the follow last asked for:
// they come apart when the user nudges a followed row by hand.
export function alreadyShowing(
  shown: FollowWindow | undefined,
  span: ResolvedSpan,
) {
  if (!shown || shown.refName !== span.refName) {
    return false
  }
  const slack = Math.max((span.end - span.start) * ALREADY_THERE_FRACTION, 1)
  return (
    Math.abs(shown.start - span.start) <= slack &&
    Math.abs(shown.end - span.end) <= slack
  )
}
