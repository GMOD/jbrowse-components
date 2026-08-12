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
  const featLen = end - start
  const mateLen = mate.end - mate.start
  const clamp = (x: number, lo: number, hi: number) =>
    Math.min(Math.max(x, lo), hi)
  const span = (a: number, b: number, refName: string) => ({
    refName,
    start: Math.floor(Math.min(a, b)),
    // at least one base: a window narrower than the rounding, or a zero-length
    // block, would otherwise produce an inverted span that assembles into an
    // inverted locstring
    end: Math.max(Math.floor(Math.min(a, b)) + 1, Math.ceil(Math.max(a, b))),
  })

  if (toMate) {
    const lo = clamp(window.start, start, end)
    const hi = clamp(window.end, start, end)
    // a zero-length block has no interior to interpolate across; both ends
    // collapse onto the mate's near corner
    const offset = (x: number) =>
      featLen > 0 ? ((x - start) / featLen) * mateLen : 0
    // a reverse-strand block runs the other way along the mate, so the walk
    // counts down from its far end and the two ends arrive swapped
    const place = (o: number) => (strand === -1 ? mate.end - o : mate.start + o)
    return span(place(offset(lo)), place(offset(hi)), mate.refName)
  }

  const lo = clamp(window.start, mate.start, mate.end)
  const hi = clamp(window.end, mate.start, mate.end)
  const offset = (x: number) => (strand === -1 ? mate.end - x : x - mate.start)
  const frac = (o: number) => (mateLen > 0 ? (o / mateLen) * featLen : 0)
  return span(start + frac(offset(lo)), start + frac(offset(hi)), feat.refName)
}
