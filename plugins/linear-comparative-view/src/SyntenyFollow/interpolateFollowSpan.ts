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
  // the axis the anchor window is on, and the one the moved row lands on
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
    // at least one base, since a zero-width span assembles into an inverted
    // locstring
    end: Math.max(lo + 1, Math.ceil(Math.max(p, q))),
  }
}
