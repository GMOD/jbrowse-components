import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Where a follow sends the moving panel when the alignment carries no CIGAR to
 * walk: the window mapped straight across the block, proportionally.
 *
 * THIS IS THE ONE PLACE THE SYNTENY CODE NAVIGATES ON AN INTERPOLATION, and it
 * is a deliberate departure from the click-driven move, which refuses (see
 * `resolveAlignmentSpan`'s note: a straight-line guess parked flush against its
 * neighbour presents itself as a correspondence). The reasoning does not carry
 * over to a follow. A PIF's coarse tier is CIGAR-less by construction and is
 * what serves whole-genome zoom, so refusing there would make the mode work
 * while zoomed in and silently stop working when zoomed out — the moving panel
 * simply stranded, with the user's own pan as the only visible cause. Between a
 * bounded approximation and a feature that quietly comes and goes with zoom, the
 * approximation is the smaller lie, and it is exactly the geometry the ribbon on
 * screen is already drawn with: no per-base correspondence is known at that
 * tier, so the band IS a straight quadrilateral between the two blocks' corners
 * and this reads the mate position off that same straight edge.
 *
 * The skew is NOT bounded by the tier's 10kb indel split threshold — many
 * smaller indels accumulate inside one coarse row without triggering a split —
 * so a caller that can tell the user the answer is approximate should.
 *
 * Both directions clamp to the block first, so a window wider than the
 * alignment (or one starting off its end) lands back on the block's own ends
 * rather than extrapolating off the far side of the mate.
 *
 * ONE FORMULA FOR BOTH DIRECTIONS, over an anchor axis `a` and a placed axis
 * `b` that swap with `toMate`. The two used to be written out separately and
 * are the same function: express the window edge as a fraction along `a` and
 * read that fraction off `b`, from its far end when the strands disagree. The
 * two spellings differed only in a degenerate corner — a reverse-strand block
 * of zero length on the anchor axis collapsed onto `b`'s near corner in one
 * direction and its far corner in the other.
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
    // a zero-length block has no interior to interpolate across; both ends
    // collapse onto b's near corner
    const u =
      aLen > 0 ? (Math.min(Math.max(x, aStart), aEnd) - aStart) / aLen : 0
    // a reverse-strand block runs the other way along the placed axis, so the
    // walk counts down from its far end and the two ends arrive swapped
    return strand === -1 ? bEnd - u * bLen : bStart + u * bLen
  }
  const p = at(window.start)
  const q = at(window.end)
  const lo = Math.floor(Math.min(p, q))
  return {
    refName: toMate ? mate.refName : feat.refName,
    start: lo,
    // at least one base: a window narrower than the rounding, or a zero-length
    // block, would otherwise produce an inverted span that assembles into an
    // inverted locstring
    end: Math.max(lo + 1, Math.ceil(Math.max(p, q))),
  }
}
