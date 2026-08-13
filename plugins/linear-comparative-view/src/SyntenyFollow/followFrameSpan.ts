import { applyFollowTransform } from './followTransform.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'
import { windowInsideFeat } from './planFollowStep.ts'

import type {
  FeatPos,
  SyntenyFeatureData,
} from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { FollowTransform } from './followTransform.ts'

/**
 * Where the followed row belongs on ONE FRAME, between exact resolves.
 *
 * Everything the exact pass does except the RPC, against the live anchor window
 * and the block the last settle chose. Pure so the answers below can be told
 * apart without driving an autorun — the difference between them is invisible
 * in a running view, which is how one of them came to be wrong.
 *
 * The cached block is only consulted while the window is still INSIDE it, where
 * the correspondence is affine and the cached transform carries the CIGAR
 * detail this pass cannot walk for itself. Past that edge the window mapping
 * answers, over every loaded block — the same thing the exact pass falls to,
 * and the thing that keeps this from having to know when the cached block has
 * stopped being relevant.
 *
 * `undefined` means HOLD THE ROW WHERE IT IS: the anchor has panned into a
 * haplotype-specific insertion, a centromere, or off the end of the alignments.
 * The mapping says so by mapping both window edges onto the same point, which
 * is what a window with no alignment under it does — and it is worth knowing
 * that the interpolators CANNOT say it. Both clamp the window to their block
 * first, so a window entirely past one collapses to a span ONE BASE WIDE and
 * flings the row to maximum zoom on that block's far edge, at the same moment
 * the header says nothing aligns here.
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
