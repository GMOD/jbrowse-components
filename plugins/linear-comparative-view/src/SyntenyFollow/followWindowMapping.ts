import { preferIncumbent } from '../syntenyHysteresis.ts'
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
  // No zero-clamp: every value `resolve` can return is a block coordinate or a
  // point between two of them, so it is already in range — and clamping only
  // `start` while `end` came off the unclamped `lo` would invert the span it was
  // added to protect.
  return hi > lo
    ? {
        refName: target.name,
        start: Math.floor(lo),
        // at least one base, since a zero-width span assembles into an inverted
        // locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}

/**
 * Where each anchor window maps to, across every alignment under it.
 *
 * Each window EDGE mapped, not the union of the mapped blocks. The union is the
 * right answer but a step function — its edges jump as blocks enter and leave —
 * which measured as 1 movement in 30 drag steps on grape/peach at 5 Mb.
 *
 * SEVERAL WINDOWS IN ONE PASS, one per contig the anchor row is showing. The
 * blocks are the expensive part — hundreds of thousands of them, scanned per
 * frame — so calling the single-window form once per contig would multiply the
 * pass by the contig count, which at whole-genome zoom is the whole assembly.
 * The answers come back positionally, `undefined` where nothing under that
 * window mapped.
 */
export function followWindowsMapping({
  data,
  windows,
  toMate,
  mateAssembly,
  incumbentTarget,
}: {
  data: SyntenyFeatureData
  windows: FollowWindow[]
  toMate: boolean
  mateAssembly?: string
  incumbentTarget?: string
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

  // One pass, and NOTHING ALLOCATED PER BLOCK — that is the measurement, not
  // "no objects": this runs per frame over hundreds of thousands of blocks on a
  // whole-genome PAF, where a small object per block measured 51ms a frame at
  // 500k against 5ms for a bare pass. A `Target` is per CONTIG PAIR, of which
  // even a whole-genome window reaches a few dozen, so the loop below allocates
  // once per pair and then only reads.
  //
  // A slot per dictionary id, not a search. Blocks do NOT arrive grouped by
  // contig — `executeSyntenyFeaturesAndPositions` sorts them by feature LENGTH
  // so big ribbons composite over sub-pixel noise — so a "same contig as last
  // block" shortcut in front of a scan hits almost never and the scan runs per
  // block. Ids are dense, since `renameDictLane` re-interns the lane. Measured
  // both ways at 300k blocks over 8, 24 and 200 contigs and there is no
  // difference; this spelling is simply the one that assumes no ordering.
  //
  // Which window a block belongs to is the same lookup one step earlier, so a
  // multi-contig pass costs one array read per block over a single-contig one
  // rather than a pass per contig. The mate-side slots are allocated LAZILY,
  // per window that a block actually reaches: an anchor showing 200 contigs
  // against a dictionary of 200 would otherwise allocate 40,000 slots to fill a
  // few hundred.
  const windowOfRefNameId = new Int32Array(windowRefNameDictLength).fill(-1)
  for (const [w, id] of windowRefNameIds.entries()) {
    if (id >= 0) {
      windowOfRefNameId[id] = w
    }
  }
  const targetsPerWindow = windows.map(() => [] as Target[])
  const slotsPerWindow = new Array<Int32Array | undefined>(windows.length)
  for (let i = 0; i < n; i++) {
    // an id past the dictionary the windows were resolved against is no
    // window's, the same answer a name no dictionary holds gets — and reading
    // it as `undefined` would sail through the test below into `windows[w]`
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
    // 0 is "no target yet", so a slot holds the index one on
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
    // ONE TARGET CONTIG PER WINDOW, by summed overlap: a genome-scale window
    // reaches several of the other assembly's, and an answer spanning them is
    // not a place. One only reached by blocks off the window's ends totals zero
    // and so never wins, which is what stops a neighbour from being picked.
    const overlap = Math.min(aHi, windowEndBp) - Math.max(aLo, windowStartBp)
    if (overlap > 0) {
      target.overlap += overlap
    }
    // `atLo`/`atHi` are the mate coordinates this block's LEFT and RIGHT anchor
    // edges map to, so a reverse-strand block simply reports them swapped and
    // one interpolation formula serves both orientations.
    const flip = data.strands[i] === -1
    const atLo = flip ? otherEnds[i]! : otherStarts[i]!
    const atHi = flip ? otherStarts[i]! : otherEnds[i]!
    offer(target.startAt, aLo, aHi, atLo, atHi)
    offer(target.endAt, aLo, aHi, atLo, atHi)
  }
  return targetsPerWindow.map(targets => {
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
    // THE SAME HYSTERESIS THE BLOCK PICK HAS, and for a case that is worse:
    // panning a window across a fusion breakpoint moves summed overlap from one
    // mate contig to the other, and the two are equal at the midpoint, so a bare
    // comparison flung the row to another chromosome on the rounding — every
    // frame, since the frame pass re-runs this. An incumbent that no block under
    // the window reaches totals zero and cannot hold the answer.
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
    incumbentTarget,
  })[0]
}
