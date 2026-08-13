import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// What one anchor coordinate has learned from the blocks seen so far: the
// widest block containing it and where that puts it, else the nearest block
// each side and where their facing edges land.
interface Accumulator {
  x: number
  insideWidth: number
  insideAt: number
  leftEnd: number
  leftAt: number
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

function offer(
  a: Accumulator,
  aLo: number,
  aHi: number,
  atLo: number,
  atHi: number,
) {
  if (a.x >= aLo && a.x <= aHi) {
    // widest containing block wins, matching pickFollowFeature
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
    a.rightStart = aLo
    a.rightAt = atLo
  }
}

// Off either end this gives the outermost block's edge rather than
// extrapolating: past the last alignment nothing is known, and a scale measured
// elsewhere would invent a correspondence.
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
 * Each window EDGE mapped, not the union of the mapped blocks. The union is the
 * right answer but a step function — its edges jump as blocks enter and leave —
 * which measured as 1 movement in 30 drag steps on grape/peach at 5 Mb.
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

  // One pass, nothing allocated per block, parallel arrays rather than a Map.
  // This runs per frame over hundreds of thousands of blocks on a whole-genome
  // PAF: allocating a small object per block measured 51ms a frame at 500k
  // against 5ms for a bare pass, so traversals and allocation are the cost.
  const names: string[] = []
  const totals: number[] = []
  const startAt: Accumulator[] = []
  const endAt: Accumulator[] = []
  let lastName: string | undefined
  let lastIdx = -1
  for (let i = 0; i < n; i++) {
    if (
      refNames[i] !== windowRefName ||
      (mateAssembly !== undefined && mateAssemblyNames[i] !== mateAssembly)
    ) {
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
        startAt.push(newAccumulator(windowStartBp))
        endAt.push(newAccumulator(windowEndBp))
      }
    }
    const aLo = Math.min(starts[i]!, ends[i]!)
    const aHi = Math.max(starts[i]!, ends[i]!)
    // ONE TARGET CONTIG, by summed overlap: a genome-scale window reaches
    // several of the other assembly's, and an answer spanning them is not a
    // place. One only reached by blocks off the window's ends totals zero and
    // so never wins, which is what stops a neighbour from being picked.
    const overlap = Math.min(aHi, windowEndBp) - Math.max(aLo, windowStartBp)
    if (overlap > 0) {
      totals[lastIdx]! += overlap
    }
    const bLo = Math.min(otherStarts[i]!, otherEnds[i]!)
    const bHi = Math.max(otherStarts[i]!, otherEnds[i]!)
    // `atLo`/`atHi` are the mate coordinates this block's LEFT and RIGHT anchor
    // edges map to, so a reverse-strand block simply reports them swapped and
    // one interpolation formula serves both orientations.
    const flip = data.strands[i] === -1
    const atLo = flip ? bHi : bLo
    const atHi = flip ? bLo : bHi
    offer(startAt[lastIdx]!, aLo, aHi, atLo, atHi)
    offer(endAt[lastIdx]!, aLo, aHi, atLo, atHi)
  }
  let target = -1
  let best = 0
  for (let i = 0; i < names.length; i++) {
    if (totals[i]! > best) {
      best = totals[i]!
      target = i
    }
  }
  if (target < 0) {
    return undefined
  }
  const p = resolve(startAt[target]!)
  const q = resolve(endAt[target]!)
  if (p === undefined || q === undefined) {
    return undefined
  }
  const lo = Math.min(p, q)
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: names[target]!,
        start: Math.max(0, Math.floor(lo)),
        // at least one base, since a zero-width span assembles into an inverted
        // locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}
