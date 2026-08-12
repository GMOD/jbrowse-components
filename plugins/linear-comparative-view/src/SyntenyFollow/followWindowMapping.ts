import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * What one anchor coordinate has learned from the blocks seen so far: the
 * widest block containing it, and failing that the nearest block ending to its
 * left and the nearest starting to its right.
 *
 * A mutable bag, one per coordinate per call, because the loop that fills it
 * runs per frame over every loaded block — see the note at the loop.
 */
interface Accumulator {
  x: number
  /** width of the widest containing block, -1 for none */
  insideWidth: number
  /** where that block puts `x` */
  insideAt: number
  /** the nearest block ending left of `x`, and where its right edge lands */
  leftEnd: number
  leftAt: number
  /** the nearest block starting right of `x`, and where its left edge lands */
  rightStart: number
  rightAt: number
}

function newAccumulator(x: number): Accumulator {
  return {
    x,
    insideWidth: -1,
    insideAt: 0,
    leftEnd: Number.NEGATIVE_INFINITY,
    leftAt: 0,
    rightStart: Number.POSITIVE_INFINITY,
    rightAt: 0,
  }
}

/** Show one block to a coordinate, in whichever of the three roles it plays. */
function offer(
  a: Accumulator,
  aLo: number,
  aHi: number,
  atLo: number,
  atHi: number,
) {
  if (a.x >= aLo && a.x <= aHi) {
    // the widest containing block wins, matching pickFollowFeature
    if (aHi - aLo > a.insideWidth) {
      a.insideWidth = aHi - aLo
      a.insideAt =
        aHi > aLo ? atLo + ((a.x - aLo) / (aHi - aLo)) * (atHi - atLo) : atLo
    }
  } else if (aHi < a.x) {
    if (aHi > a.leftEnd) {
      a.leftEnd = aHi
      a.leftAt = atHi
    }
  } else if (aLo < a.rightStart) {
    // starts right of `x`, which is the only case left, and nearer than any
    // other seen so far
    a.rightStart = aLo
    a.rightAt = atLo
  }
}

/**
 * The coordinate's mapped position.
 *
 * Inside a block, through that block. Between two, linearly between the
 * neighbours' facing edges — which is continuous, because at a block boundary
 * the gap interpolation starts from exactly the value the block itself gives
 * there. Off either end, the outermost block's edge: past the last alignment
 * nothing is known, and extrapolating a scale measured elsewhere would invent a
 * correspondence rather than admit there is none.
 */
function resolve(a: Accumulator) {
  if (a.insideWidth >= 0) {
    return a.insideAt
  }
  const hasLeft = a.leftEnd !== Number.NEGATIVE_INFINITY
  const hasRight = a.rightStart !== Number.POSITIVE_INFINITY
  if (hasLeft && hasRight) {
    return (
      a.leftAt +
      ((a.x - a.leftEnd) / (a.rightStart - a.leftEnd)) * (a.rightAt - a.leftAt)
    )
  }
  return hasLeft ? a.leftAt : hasRight ? a.rightAt : undefined
}

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

  const mateAssemblyNames = data.mateAssemblyNames
  const {
    refName: windowRefName,
    start: windowStartBp,
    end: windowEndBp,
  } = window
  const n = refNames.length

  // Which contig of the other assembly most of the window aligns to, totalled
  // in two PARALLEL ARRAYS rather than a Map. A Map costs a hash, a get and a
  // set per element, and this walks every loaded block: at 500k that alone
  // measured most of the pass. The names are few — one contig in the ordinary
  // case, a handful across a rearrangement — so a linear scan of the array is
  // shorter than hashing, and `lastName` makes the common run of identical
  // names a pointer compare and nothing else.
  const names: string[] = []
  const totals: number[] = []
  let lastName: string | undefined
  let lastIdx = -1
  for (let i = 0; i < n; i++) {
    if (
      refNames[i] !== windowRefName ||
      (mateAssembly !== undefined && mateAssemblyNames[i] !== mateAssembly)
    ) {
      continue
    }
    const overlap =
      Math.min(Math.max(starts[i]!, ends[i]!), windowEndBp) -
      Math.max(Math.min(starts[i]!, ends[i]!), windowStartBp)
    if (overlap <= 0) {
      continue
    }
    const name = otherRefNames[i]!
    if (name !== lastName) {
      lastName = name
      lastIdx = names.indexOf(name)
      if (lastIdx < 0) {
        lastIdx = names.length
        names.push(name)
        totals.push(0)
      }
    }
    totals[lastIdx]! += overlap
  }
  let target: string | undefined
  let best = 0
  for (let i = 0; i < names.length; i++) {
    if (totals[i]! > best) {
      best = totals[i]!
      target = names[i]
    }
  }
  if (target === undefined) {
    return undefined
  }

  // BOTH EDGES IN ONE PASS, AND NOTHING ALLOCATED INSIDE IT. This runs per
  // frame while a drag is in progress, over every loaded block, and a
  // whole-genome PAF's loaded set runs to hundreds of thousands of them. The
  // readable version — a helper returning a small object per block, called once
  // per edge — measured 51ms a frame at 500k blocks, three times a 60fps
  // budget, and the object churn rather than the arithmetic was almost all of
  // it: a single bare pass over the same arrays costs 5ms.
  const windowStart = newAccumulator(windowStartBp)
  const windowEnd = newAccumulator(windowEndBp)
  for (let i = 0; i < n; i++) {
    if (
      otherRefNames[i] !== target ||
      refNames[i] !== windowRefName ||
      (mateAssembly !== undefined && mateAssemblyNames[i] !== mateAssembly)
    ) {
      continue
    }
    const aLo = Math.min(starts[i]!, ends[i]!)
    const aHi = Math.max(starts[i]!, ends[i]!)
    const bLo = Math.min(otherStarts[i]!, otherEnds[i]!)
    const bHi = Math.max(otherStarts[i]!, otherEnds[i]!)
    // `atLo`/`atHi` are the mate coordinates this block's LEFT and RIGHT anchor
    // edges map to, so a reverse-strand block simply reports them swapped and
    // one interpolation formula serves both orientations.
    const flip = data.strands[i] === -1
    const atLo = flip ? bHi : bLo
    const atHi = flip ? bLo : bHi
    offer(windowStart, aLo, aHi, atLo, atHi)
    offer(windowEnd, aLo, aHi, atLo, atHi)
  }
  const p = resolve(windowStart)
  const q = resolve(windowEnd)
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
