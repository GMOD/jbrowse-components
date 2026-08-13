import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * The window mapped straight across one block, for an alignment with no CIGAR
 * to walk. Clamped to the block, so a window wider than the alignment lands on
 * its ends rather than off the far side of the mate.
 *
 * THE ONE PLACE THE SYNTENY CODE NAVIGATES ON AN INTERPOLATION, unlike the
 * click-driven move, which refuses (`resolveAlignmentSpan`). A PIF's coarse
 * tier is CIGAR-less by construction and serves whole-genome zoom, so refusing
 * would make the mode work zoomed in and silently stop working zoomed out. The
 * skew is not bounded by the tier's 10kb indel split threshold, so a caller
 * that can say the answer is approximate should.
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
  const { start, end, mate, strand } = feat
  const aStart = toMate ? start : mate.start
  const aEnd = toMate ? end : mate.end
  const bStart = toMate ? mate.start : start
  const bEnd = toMate ? mate.end : end
  const aLen = aEnd - aStart
  const bLen = bEnd - bStart

  const at = (x: number) => {
    const u =
      aLen > 0 ? (Math.min(Math.max(x, aStart), aEnd) - aStart) / aLen : 0
    return strand === -1 ? bEnd - u * bLen : bStart + u * bLen
  }
  const p = at(window.start)
  const q = at(window.end)
  const lo = Math.floor(Math.min(p, q))
  return {
    refName: toMate ? mate.refName : feat.refName,
    start: lo,
    // at least one base, since a zero-width span assembles into an inverted
    // locstring
    end: Math.max(lo + 1, Math.ceil(Math.max(p, q))),
  }
}
