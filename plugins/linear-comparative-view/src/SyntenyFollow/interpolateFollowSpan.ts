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
  const aLen = a.end - a.start
  const bLen = b.end - b.start

  const at = (x: number) => {
    const u =
      aLen > 0 ? (Math.min(Math.max(x, a.start), a.end) - a.start) / aLen : 0
    return feat.strand === -1 ? b.end - u * bLen : b.start + u * bLen
  }
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
