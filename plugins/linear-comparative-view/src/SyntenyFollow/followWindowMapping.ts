import { unnamedNameId } from '@jbrowse/synteny-core'

import { preferIncumbent, voteEvidence } from '../syntenyHysteresis.ts'
import { followAxes } from './followAxes.ts'

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

// One candidate contig on the other axis: how much of the window aligns to it,
// and where the window's two edges land on it.
interface Target {
  name: string
  overlap: number
  startAt: Accumulator
  endAt: Accumulator
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

// The window's two mapped edges as a span, once its target contig is known.
function span(target: Target): ResolvedSpan | undefined {
  const p = resolve(target.startAt)
  const q = resolve(target.endAt)
  if (p === undefined || q === undefined) {
    return undefined
  }
  const lo = Math.min(p, q)
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: target.name,
        start: Math.floor(lo),
        // a zero-width span assembles into an inverted locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}

/**
 * Where each anchor window maps to, across every alignment under it,
 * positionally, `undefined` where nothing under that window mapped.
 *
 * Each window edge is mapped, not the union of the mapped blocks: the union is
 * a step function, measured as 1 movement in 30 drag steps on grape/peach at
 * 5 Mb. Every window goes in one scan of the blocks, since the blocks are the
 * per-frame cost and a whole-genome anchor has as many windows as contigs.
 */
export function followWindowsMapping({
  data,
  windows,
  toMate,
  mateAssembly,
  incumbentTargets,
}: {
  data: SyntenyFeatureData
  windows: FollowWindow[]
  toMate: boolean
  mateAssembly?: string
  // per window, the contig it last mapped to
  incumbentTargets?: readonly (string | undefined)[]
}): (ResolvedSpan | undefined)[] {
  const {
    refNameIds,
    starts,
    ends,
    otherRefNameIds,
    otherRefNameDict,
    otherStarts,
    otherEnds,
    windowRefNameIds,
    windowRefNameDictLength,
    mateAssemblyNameIds,
    mateAssemblyId,
  } = followAxes({ data, windows, toMate, mateAssembly })
  const n = refNameIds.length

  // Nothing is allocated per block: an object per block measured 51ms a frame
  // at 500k blocks against 5ms for a bare pass. A `Target` is per contig pair.
  // Blocks arrive sorted by length, not grouped by contig, so each lookup is a
  // slot per dictionary id; the mate-side slots are allocated per window a
  // block reaches.
  const unnamedId = unnamedNameId(data.nameDict)
  const windowOfRefNameId = new Int32Array(windowRefNameDictLength).fill(-1)
  for (const [w, id] of windowRefNameIds.entries()) {
    if (id >= 0) {
      windowOfRefNameId[id] = w
    }
  }
  const targetsPerWindow = windows.map(() => [] as Target[])
  const slotsPerWindow = new Array<Int32Array | undefined>(windows.length)
  for (let i = 0; i < n; i++) {
    const w = windowOfRefNameId[refNameIds[i]!] ?? -1
    if (
      w < 0 ||
      (mateAssemblyId !== undefined &&
        mateAssemblyNameIds[i] !== mateAssemblyId)
    ) {
      continue
    }
    const { start: windowStartBp, end: windowEndBp } = windows[w]!
    const targets = targetsPerWindow[w]!
    let slots = slotsPerWindow[w]
    if (!slots) {
      slots = new Int32Array(otherRefNameDict.length)
      slotsPerWindow[w] = slots
    }
    const nameId = otherRefNameIds[i]!
    // 0 is "no target yet", so a slot holds the index plus one
    let slot = slots[nameId]!
    if (slot === 0) {
      slot = targets.length + 1
      slots[nameId] = slot
      targets.push({
        name: otherRefNameDict[nameId]!,
        overlap: 0,
        startAt: newAccumulator(windowStartBp),
        endAt: newAccumulator(windowEndBp),
      })
    }
    const target = targets[slot - 1]!
    const aLo = starts[i]!
    const aHi = ends[i]!
    // one target contig per window, by the same `voteEvidence` the multi-way
    // lane and the launch vote with; a block off the window's ends adds nothing
    const overlap = Math.min(aHi, windowEndBp) - Math.max(aLo, windowStartBp)
    if (overlap > 0) {
      target.overlap += voteEvidence(data.nameIds[i]! !== unnamedId, overlap)
    }
    // where this block's left and right anchor edges land on the mate
    const flip = data.strands[i] === -1
    const atLo = flip ? otherEnds[i]! : otherStarts[i]!
    const atHi = flip ? otherStarts[i]! : otherEnds[i]!
    offer(target.startAt, aLo, aHi, atLo, atHi)
    offer(target.endAt, aLo, aHi, atLo, atHi)
  }
  return targetsPerWindow.map((targets, w) => {
    const incumbentTarget = incumbentTargets?.[w]
    let best: Target | undefined
    let incumbent: Target | undefined
    for (const t of targets) {
      if (!best || t.overlap > best.overlap) {
        best = t
      }
      if (t.name === incumbentTarget) {
        incumbent = t
      }
    }
    // hysteresis, or a fusion breakpoint flips the row between chromosomes on
    // the rounding, every frame
    const chosen = preferIncumbent(best, incumbent)
    return chosen && chosen.overlap > 0 ? span(chosen) : undefined
  })
}

/**
 * Where one anchor window maps to. The single-contig case of
 * {@link followWindowsMapping}, which is every case below whole-genome zoom.
 */
export function followWindowMapping({
  data,
  window,
  toMate,
  mateAssembly,
  incumbentTarget,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  incumbentTarget?: string
}) {
  return followWindowsMapping({
    data,
    windows: [window],
    toMate,
    mateAssembly,
    incumbentTargets: [incumbentTarget],
  })[0]
}
