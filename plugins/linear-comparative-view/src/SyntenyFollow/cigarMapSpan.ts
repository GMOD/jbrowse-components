import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Read one axis's offset off the map at a point on the other.
 *
 * `into[i]` where `from[i]` first reaches `x`, interpolated between the two
 * points it falls between. First rather than last is the half-open rule
 * `findPosInCigar` breaks the same tie with: an insertion sitting exactly at `x`
 * is zero-width on the feature axis and is NOT consumed, so the answer is the
 * offset before it. Getting that backwards moves the row by the insertion's
 * whole length every time a window edge lands on one.
 */
function readAt(from: Uint32Array, into: Uint32Array, x: number) {
  const n = from.length
  let lo = 0
  let hi = n
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (from[mid]! < x) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  if (lo === 0) {
    return into[0]!
  }
  if (lo === n) {
    return into[n - 1]!
  }
  const a = from[lo - 1]!
  const b = from[lo]!
  // equal only across a run the other axis crossed alone, where every point
  // between them is the same answer
  return b > a
    ? into[lo - 1]! + ((x - a) / (b - a)) * (into[lo]! - into[lo - 1]!)
    : into[lo]!
}

/**
 * The window mapped through one alignment's CIGAR, on the main thread.
 *
 * WHAT THE FRAME PASS USES INSTEAD OF EXTRAPOLATING. `applyFollowTransform` is a
 * straight line fitted to the last settled window, so panning away from that
 * window drifts by the indels in between and the next settle snaps the row back;
 * this reads the indels themselves and is within `map.toleranceBp` either side
 * of the walk the settle would do. The settle then agrees with where the row
 * already is, which is what makes the snap go away rather than get smaller.
 *
 * The same conventions as `resolveAlignmentSpan`, deliberately duplicated rather
 * than shared: that one walks ops and this one reads a map, but a window is
 * clamped to the block on both and a reverse-strand mate is counted down from
 * its far end on both. They are checked against each other in
 * `cigarMapSpan.test.ts`.
 *
 * `undefined` when the map does not describe THIS block. The offsets count from
 * coordinates the map carries and the caller holds separately, so a map that
 * outlived its pick — a refetch renumbering ids across a LOD tier, a level
 * re-picking mid-flight — would otherwise be read against the wrong ones.
 *
 * FRACTIONAL bp, like the rest of the frame pass: `positionViewOnSpan` is pixel
 * arithmetic, and rounding here quantizes the row's motion to whole bases.
 */
export function cigarMapSpan({
  feat,
  map,
  window,
  toMate,
}: {
  feat: FeatPos
  map: SyntenyCigarMapResult
  window: FollowWindow
  toMate: boolean
}): ResolvedSpan | undefined {
  const { mate } = feat
  if (
    map.start !== feat.start ||
    map.end !== feat.end ||
    map.mateStart !== mate.start ||
    map.mateEnd !== mate.end ||
    map.strand !== feat.strand
  ) {
    return undefined
  }
  const { featOffsets, mateOffsets } = map
  if (featOffsets.length < 2) {
    return undefined
  }
  const clamp = (x: number, lo: number, hi: number) =>
    Math.min(Math.max(x, lo), hi)
  const flipped = feat.strand === -1

  let refName: string
  let a: number
  let b: number
  if (toMate) {
    const lo = clamp(window.start, feat.start, feat.end)
    const hi = clamp(window.end, feat.start, feat.end)
    const mLo = readAt(featOffsets, mateOffsets, lo - feat.start)
    const mHi = readAt(featOffsets, mateOffsets, hi - feat.start)
    refName = mate.refName
    a = flipped ? mate.end - mLo : mate.start + mLo
    b = flipped ? mate.end - mHi : mate.start + mHi
  } else {
    const lo = clamp(window.start, mate.start, mate.end)
    const hi = clamp(window.end, mate.start, mate.end)
    // the mate axis is stored genomically and walked from whichever end the
    // alignment starts at, so a reverse block's window arrives swapped
    const offset = (x: number) => (flipped ? mate.end - x : x - mate.start)
    const oLo = Math.min(offset(lo), offset(hi))
    const oHi = Math.max(offset(lo), offset(hi))
    refName = feat.refName
    a = feat.start + readAt(mateOffsets, featOffsets, oLo)
    b = feat.start + readAt(mateOffsets, featOffsets, oHi)
  }

  const start = Math.min(a, b)
  const end = Math.max(a, b)
  // a window that maps onto a single coordinate is not a place, and the frame
  // pass holds the row rather than flinging it to base-level zoom
  return end > start ? { refName, start, end } : undefined
}
