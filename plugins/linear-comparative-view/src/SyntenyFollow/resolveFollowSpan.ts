import { resolveMatchingSpan } from '../LinearSyntenyDisplay/moveMatchingPanel.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowStep } from './planFollowStep.ts'

export interface FollowAnswer {
  span: ResolvedSpan
  // with the answer, since `hasCigar` is per fetch and only an empty walk says
  // this block had none
  approximate: boolean
}

// one alignment only when the window is inside one: both single-block
// resolvers clamp the window to the block
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
