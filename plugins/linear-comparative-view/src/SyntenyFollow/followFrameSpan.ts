import { cigarMapSpan } from './cigarMapSpan.ts'
import { applyFollowTransform } from './followTransform.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'
import { windowInsideFeat } from './windowInsideFeat.ts'

import type {
  FeatPos,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
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
 *
 * THREE WAYS TO ANSWER, BEST FIRST. The map reads the block's own indels and is
 * what the settle would say; the transform is a straight line fitted to the last
 * settled window, so it drifts by whatever indels lie between that window and
 * this one; the interpolation is a straight line across the whole block, which
 * is all a CIGAR-less block supports. The map is the reason the settle stopped
 * being visible: it agrees with where the row already is, so `alreadyShowing`
 * says yes and nothing navigates.
 *
 * FRACTIONAL bp, unlike every other `ResolvedSpan` here, and deliberately: the
 * cached transform is the smooth path and rounding it quantizes the row's
 * motion to whole bases, which below 1 bp/px is a visible stutter. So this feeds
 * `positionViewOnSpan`, which is pixel arithmetic, and never `navToResolvedSpan`,
 * which would assemble a locstring out of it.
 */
export function followFrameSpan({
  feat,
  data,
  window,
  toMate,
  mateAssembly,
  transform,
  map,
  incumbentTarget,
}: {
  feat: FeatPos
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  transform?: FollowTransform
  map?: SyntenyCigarMapResult
  incumbentTarget?: string
}): ResolvedSpan | undefined {
  return windowInsideFeat(feat, window, toMate)
    ? ((map ? cigarMapSpan({ feat, map, window, toMate }) : undefined) ??
        (transform ? applyFollowTransform(transform, window) : undefined) ??
        interpolateFollowSpan({ feat, window, toMate }))
    : followWindowMapping({
        data,
        window,
        toMate,
        mateAssembly,
        incumbentTarget,
      })
}
