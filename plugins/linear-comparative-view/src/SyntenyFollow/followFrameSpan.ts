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
 * Where the followed row belongs on one frame, against the live window and the
 * block the last settle chose: the CIGAR map, else the settle's transform, else
 * an interpolation across the block. `undefined` holds the row.
 *
 * Fractional bp, so it feeds `positionViewOnSpan` and never `navToResolvedSpan`:
 * rounding quantizes the row's motion to whole bases.
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
