import { applyFollowTransform } from './followTransform.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'
import { windowInsideFeat } from './windowInsideFeat.ts'

import type {
  FeatPos,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowTransform } from './followTransform.ts'

/**
 * Where the followed row belongs on ONE FRAME: everything the exact pass does
 * except the RPC, against the live window and the block the last settle chose.
 *
 * `undefined` means hold the row where it is, and only the mapping can say it —
 * the interpolators clamp the window to their block, so one panned clean off
 * collapses to a span ONE BASE WIDE and flings the row to maximum zoom.
 */
export function followFrameSpan({
  feat,
  data,
  window,
  toMate,
  mateAssembly,
  transform,
}: {
  feat: FeatPos
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  transform?: FollowTransform
}): ResolvedSpan | undefined {
  return windowInsideFeat(feat, window, toMate)
    ? ((transform ? applyFollowTransform(transform, window) : undefined) ??
        interpolateFollowSpan({ feat, window, toMate }))
    : followWindowMapping({ data, window, toMate, mateAssembly })
}
