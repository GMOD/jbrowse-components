import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// How far the moving panel may already be from the span a follow resolved to
// before it is worth navigating, as a fraction of that span. Two things need
// this to be a tolerance rather than an equality test. A refetch lands on every
// pass and rewakes the autorun, so the ordinary case is re-resolving a panel
// that is ALREADY where it belongs; and navToLocString fits the span to the pane
// rather than landing on it exactly, so the panel never reports back the numbers
// it was given. Without the slack the two of those together renavigate the panel
// indefinitely, each time by a few bp.
const ALREADY_THERE_FRACTION = 0.02

/**
 * Whether the moving row is close enough to `span` that navigating would be
 * churn.
 *
 * WHERE THE ROW ACTUALLY IS, not what the follow last asked for. The two come
 * apart when the user nudges a followed row by hand, and a follow that
 * remembered only its own request would leave the row where the user put it
 * while still reporting itself as following.
 *
 * Pure, over a window the caller read while it was tracking. That is what lets
 * the moving row's settled position be an ordinary DEPENDENCY of the follow —
 * nudge a followed row and, once it settles, the follow wakes and puts it back —
 * rather than something read behind the scheduler's back from an async
 * continuation.
 */
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
