import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * Where the anchor window maps to, across every alignment under it.
 *
 * A CONTINUOUS function of the window, which is the whole reason this is not
 * just the union of the mapped blocks. The union is the right ANSWER — it is
 * what aligns to the window — but it is a step function: its edges are set by
 * whichever blocks are currently outermost, so they sit still through a pan and
 * then jump when a block enters or leaves. Following it literally measured as 1
 * movement in 30 drag steps on grape/peach at 5 Mb, which is a stair, and a
 * stair is what the user sees as jumpy. Mapping each window EDGE instead —
 * through the block it sits in, or across the gap between the two it sits
 * between — moves smoothly and agrees with the union wherever the union is
 * defined.
 *
 * ONE TARGET CONTIG, chosen by summed overlap. A genome-scale window overlaps
 * blocks landing on several contigs of the other assembly, and an answer
 * spanning all of them is not a place. Same rule `followAnchorWindow` uses to
 * pick the anchor's own contig, and a no-op when only one contig is involved.
 *
 * Interpolated per block rather than CIGAR-walked: this serves the case where
 * the window is wider than one alignment, so the answer is an extent rather
 * than a coordinate, and the exact walk still runs where a window sits inside a
 * single block.
 */
export function followWindowMapping({
  data,
  window,
  toMate,
  mateAssembly,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
}): ResolvedSpan | undefined {
  const refNames = toMate ? data.refNames : data.mateRefNames
  const starts = toMate ? data.starts : data.mateStarts
  const ends = toMate ? data.ends : data.mateEnds
  const otherRefNames = toMate ? data.mateRefNames : data.refNames
  const otherStarts = toMate ? data.mateStarts : data.starts
  const otherEnds = toMate ? data.mateEnds : data.ends

  const qualifies = (i: number) =>
    refNames[i] === window.refName &&
    (mateAssembly === undefined || data.mateAssemblyNames[i] === mateAssembly)
  const overlapOf = (i: number) =>
    Math.min(Math.max(starts[i]!, ends[i]!), window.end) -
    Math.max(Math.min(starts[i]!, ends[i]!), window.start)

  const overlapByRefName = new Map<string, number>()
  for (let i = 0; i < refNames.length; i++) {
    if (qualifies(i) && overlapOf(i) > 0) {
      const key = otherRefNames[i]!
      overlapByRefName.set(key, (overlapByRefName.get(key) ?? 0) + overlapOf(i))
    }
  }
  let target: string | undefined
  let best = 0
  for (const [refName, overlap] of overlapByRefName) {
    if (overlap > best) {
      best = overlap
      target = refName
    }
  }
  if (target === undefined) {
    return undefined
  }

  // One block, in the form the mapping below needs: both axes ascending, with
  // `flip` carrying the orientation so a reverse-strand block still maps its
  // left edge to the mate's right.
  const block = (i: number) => {
    const aLo = Math.min(starts[i]!, ends[i]!)
    const aHi = Math.max(starts[i]!, ends[i]!)
    const bLo = Math.min(otherStarts[i]!, otherEnds[i]!)
    const bHi = Math.max(otherStarts[i]!, otherEnds[i]!)
    const flip = data.strands[i] === -1
    return {
      aLo,
      aHi,
      // the mate coordinate this block's left and right anchor edges map to
      atLo: flip ? bHi : bLo,
      atHi: flip ? bLo : bHi,
      within: (x: number) =>
        aHi > aLo
          ? (flip ? bHi : bLo) +
            ((x - aLo) / (aHi - aLo)) *
              ((flip ? bLo : bHi) - (flip ? bHi : bLo))
          : bLo,
    }
  }

  /**
   * One anchor coordinate mapped onto the target contig.
   *
   * Inside a block, through that block. Between two, linearly between the
   * neighbours' facing edges — which is continuous, because at a block boundary
   * the gap interpolation starts from exactly the value the block itself gives
   * there. Off either end, the outermost block's edge: past the last alignment
   * nothing is known, and extrapolating a scale measured elsewhere would invent
   * a correspondence rather than admit there is none.
   */
  const mapCoord = (x: number) => {
    let inside: number | undefined
    let leftEnd: number | undefined
    let leftAt = 0
    let rightStart: number | undefined
    let rightAt = 0
    for (let i = 0; i < refNames.length; i++) {
      if (!qualifies(i) || otherRefNames[i] !== target) {
        continue
      }
      const b = block(i)
      if (x >= b.aLo && x <= b.aHi) {
        // the widest containing block wins, matching pickFollowFeature
        if (inside === undefined || b.aHi - b.aLo > inside) {
          inside = b.aHi - b.aLo
          leftEnd = undefined
          rightStart = undefined
          leftAt = b.within(x)
        }
      } else if (inside === undefined && b.aHi < x) {
        if (leftEnd === undefined || b.aHi > leftEnd) {
          leftEnd = b.aHi
          leftAt = b.atHi
        }
      } else if (inside === undefined && b.aLo > x) {
        if (rightStart === undefined || b.aLo < rightStart) {
          rightStart = b.aLo
          rightAt = b.atLo
        }
      }
    }
    if (inside !== undefined) {
      return leftAt
    }
    if (leftEnd !== undefined && rightStart !== undefined) {
      return (
        leftAt + ((x - leftEnd) / (rightStart - leftEnd)) * (rightAt - leftAt)
      )
    }
    return leftEnd !== undefined
      ? leftAt
      : rightStart !== undefined
        ? rightAt
        : undefined
  }

  const p = mapCoord(window.start)
  const q = mapCoord(window.end)
  if (p === undefined || q === undefined) {
    return undefined
  }
  const lo = Math.min(p, q)
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: target,
        start: Math.max(0, Math.floor(lo)),
        // at least one base, since a zero-width span assembles into an inverted
        // locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}
