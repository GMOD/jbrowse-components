import { clamp } from '@jbrowse/core/util'

import { mateBpAt } from '../mateBpAt.ts'

import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The window mapped straight across one block, clamped to it, for an alignment
 * with no CIGAR to walk. Approximate: nothing bounds the skew across the block.
 */
export function interpolateFollowSpan({
  feat,
  window,
  toMate,
}: {
  feat: FeatPos
  window: FollowWindow
  toMate: boolean
}): ResolvedSpan {
  const a = toMate ? feat : feat.mate
  const b = toMate ? feat.mate : feat
  const at = (x: number) =>
    mateBpAt(a, b, feat.strand, clamp(x, a.start, a.end))
  const p = at(window.start)
  const q = at(window.end)
  const lo = Math.floor(Math.min(p, q))
  return {
    refName: b.refName,
    start: lo,
    // a collapse stays collapsed for the caller's zero-width check
    end: p === q ? lo : Math.max(lo + 1, Math.ceil(Math.max(p, q))),
  }
}
