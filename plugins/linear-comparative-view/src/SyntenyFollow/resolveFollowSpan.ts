import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowStep } from './planFollowStep.ts'

export interface FollowAnswer {
  span: ResolvedSpan
  // Proportional rather than walked, which is what the header reports — or
  // walked through a coarse fold at a zoom where its gap is wider than a pixel.
  // It comes back with the answer because the PLAN cannot always tell:
  // `hasCigar` is per-FETCH, so a mixed file reaches the walk with a block that
  // has none and only the empty result says so.
  approximate: boolean
}

/**
 * ONE ALIGNMENT ONLY WHEN THE WINDOW IS INSIDE ONE: both single-block resolvers
 * clamp the window to the block, so past that edge the row would land on the
 * block's own width however far the anchor is zoomed out.
 */
export async function resolveFollowSpan(
  step: FollowStep,
): Promise<FollowAnswer> {
  const { display, feat, window, toMate, hasCigar, windowInsideFeat } = step
  const interpolated = () => ({
    span: interpolateFollowSpan({ feat, window, toMate }),
    approximate: true,
  })
  if (!windowInsideFeat) {
    return step.envelope
      ? { span: step.envelope, approximate: true }
      : interpolated()
  }
  const walked = hasCigar
    ? await resolveMatchingSpan({ model: display, feat, window, toMate })
    : undefined
  return walked
    ? { span: walked, approximate: display.coarseWalkIsApproximate }
    : interpolated()
}
