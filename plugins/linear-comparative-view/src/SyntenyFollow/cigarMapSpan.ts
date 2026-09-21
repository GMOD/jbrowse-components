import type { FeatPos } from '../LinearSyntenyDisplay/model.ts'
import type { SyntenyCigarMapResult } from '../LinearSyntenyRPC/SyntenyGetCigarMap.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * One axis's offset at a point on the other, interpolated. Where `from` first
 * reaches `x`, the half-open rule `findPosInCigar` uses: an insertion exactly at
 * `x` is not consumed.
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
 * The window mapped through one alignment's CIGAR map, within `toleranceBp` of
 * the walk the settle would do. It keeps `resolveAlignmentSpan`'s conventions,
 * checked against it in `cigarMapSpan.test.ts`. `undefined` when the map is not
 * this block's. Fractional bp, like the rest of the frame pass.
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
  return end > start ? { refName, start, end } : undefined
}
