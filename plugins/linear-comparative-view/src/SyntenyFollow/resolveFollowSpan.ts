import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { FollowStep } from './planFollowStep.ts'

/**
 * ONE ALIGNMENT ONLY WHEN THE WINDOW IS INSIDE ONE: both single-block resolvers
 * clamp the window to the block, so past that edge the row would land on the
 * block's own width however far the anchor is zoomed out.
 *
 * `hasCigar` is per-FETCH, so a file that mixes them reaches the walk and gets
 * nothing back; falling through keeps those blocks followable.
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
