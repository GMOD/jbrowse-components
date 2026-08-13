import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { FollowStep } from './planFollowStep.ts'

/**
 * Where the moving row belongs, for one planned step.
 *
 * ONE ALIGNMENT ONLY WHEN THE WINDOW IS INSIDE ONE. Both single-block resolvers
 * clamp the window to the block, which is right — a block says nothing about
 * sequence outside itself — and which makes their answer useless once the
 * window is wider: the row lands on the block's own width however far the
 * anchor is zoomed out. So the envelope serves the rest.
 *
 * The test is the containment itself rather than a coverage threshold, so there
 * is no number to tune and the two agree at the boundary.
 *
 * Within the exact case, the CIGAR walk where there is one and interpolation
 * where there is not. `hasCigar` is per-FETCH, so a file that mixes them (a
 * chain set with a few CIGAR-less rows, a PAF concatenated from two runs)
 * reaches the walk and gets nothing back; falling through keeps those blocks
 * followable, on the same terms as a wholly CIGAR-less tier.
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
