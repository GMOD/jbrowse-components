import { applyFollowTransform } from './followTransform.ts'
import { followWindowMapping } from './followWindowMapping.ts'
import { interpolateFollowSpan } from './interpolateFollowSpan.ts'
import { windowInsideFeat, windowOverlapsFeat } from './planFollowStep.ts'

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
 * and the block the last settle chose. Pure so the three answers below can be
 * told apart without driving an autorun — the difference between them is
 * invisible in a running view, which is how the last one came to be wrong.
 *
 * `undefined` means HOLD THE ROW WHERE IT IS.
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
  if (windowInsideFeat(feat, window, toMate)) {
    // the CIGAR-walked answer, carried forward affinely — better than
    // re-interpolating the block, which is what this pass would otherwise have
    // to do without the RPC
    return (
      (transform ? applyFollowTransform(transform, window) : undefined) ??
      interpolateFollowSpan({ feat, window, toMate })
    )
  }
  const mapped = followWindowMapping({ data, window, toMate, mateAssembly })
  if (mapped) {
    return mapped
  }
  // NOTHING ALIGNS TO THE WINDOW AND IT NO LONGER TOUCHES THE CACHED BLOCK: the
  // anchor has panned into a haplotype-specific insertion, a centromere, or off
  // the end of the alignments. The row holds, which is what the exact pass does
  // in the same situation — it raises `followUnaligned` for the header and
  // places nothing.
  //
  // Interpolating here does not hold it, which is the trap. Both interpolating
  // resolvers clamp the window to the block first, so a window entirely past
  // the block collapses onto one corner and the span comes back ONE BASE WIDE:
  // the followed row is flung to maximum zoom on the block's far edge, at the
  // same moment the header says nothing aligns here. Only interpolate where
  // there is still an interior to interpolate across.
  return windowOverlapsFeat(feat, window, toMate)
    ? interpolateFollowSpan({ feat, window, toMate })
    : undefined
}
