import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { FollowStep } from './planFollowStep.ts'

/**
 * Where the moving row belongs, for one planned step.
 *
 * ONE ALIGNMENT ONLY WHEN THE WINDOW IS INSIDE ONE. Both single-block resolvers
 * clamp the window to the block before mapping it, which is right — a block
 * says nothing about sequence outside itself — and which makes the single-block
 * answer useless once the window is wider than the block: the followed row
 * lands on the block's own width however far the anchor is zoomed out. So the
 * exact walk serves the case it is exact for, and the envelope (the union of
 * everything under the window) serves the rest.
 *
 * The test is the containment itself rather than a coverage threshold, so there
 * is no number to tune and the two agree at the boundary: a window that just
 * fits inside a block resolves the same either way, and one that just escapes it
 * picks up the neighbouring blocks it now overlaps.
 *
 * Within the exact case, the CIGAR walk where there is one to walk and
 * interpolation where there is not. `hasCigar` is per-FETCH, not per-feature —
 * true when any block in the response carried one — so a file that mixes them (a
 * chain set with a few CIGAR-less rows, a PAF concatenated from two runs)
 * reaches the walk and gets nothing back. Falling through rather than giving up
 * keeps those blocks followable, on the same terms as a wholly CIGAR-less tier.
 */
export async function resolveFollowSpan(step: FollowStep) {
  const { display, feat, window, toMate, hasCigar, windowInsideFeat } = step
  if (!windowInsideFeat) {
    return step.envelope ?? interpolateFollowSpan({ feat, window, toMate })
  }
  const walked = hasCigar
    ? await resolveMatchingSpan({ model: display, feat, window, toMate })
    : undefined
  return walked ?? interpolateFollowSpan({ feat, window, toMate })
}
