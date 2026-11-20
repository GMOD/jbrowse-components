import { unnamedNameId } from '@jbrowse/synteny-core'

import { preferIncumbent, voteEvidence } from '../syntenyHysteresis.ts'
import { followAxes } from './followAxes.ts'

import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'

// A piece worth naming beside the one the row shows; below it are the repeat
// fragments nearly every window has somewhere on its target contig.
const NOTABLE_SHARE = 0.25

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

/**
 * A run of one target contig's blocks under the window, ordered along the
 * mate, with no gap between neighbours wider than the window itself: the
 * stretch of the mate the window's alignments land on, and the stretch of the
 * window that lands there.
 */
export interface FollowPiece {
  mate: ResolvedSpan
  anchor: ResolvedSpan
  overlap: number
}

export interface FollowEnvelope {
  span: ResolvedSpan
  // the window's other notable pieces on the target contig, heaviest first:
  // aligned, but too far along the mate from `span` to show beside it
  elsewhere: FollowPiece[]
}

// One window-wide stretch of a target contig, keyed by where on the mate a
// block's part facing the window starts: the window's alignments that land
// there (flat numbers, written per block), and what the window's two edges
// learned from its blocks.
interface Bin {
  key: number
  overlap: number
  mateLo: number
  mateHi: number
  anchorLo: number
  anchorHi: number
  startAt: Accumulator
  endAt: Accumulator
}

// One candidate contig on the other axis: how much of the window aligns to it,
// by `voteEvidence`, and its bins.
interface Target {
  name: string
  overlap: number
  bins: Map<number, Bin>
  // blocks arrive by length, so this saves a lookup only when bins are wide;
  // with one bin, every lookup
  last: Bin | undefined
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

// What two sets of blocks taught one coordinate, as if offered as one set:
// each field keeps the winner, so bins merge in any order.
function merge(into: Accumulator, from: Accumulator) {
  if (from.insideWidth > into.insideWidth) {
    into.insideWidth = from.insideWidth
    into.insideAt = from.insideAt
  }
  if (from.leftEnd > into.leftEnd) {
    into.leftEnd = from.leftEnd
    into.leftAt = from.leftAt
  }
  if (from.rightStart < into.rightStart) {
    into.rightStart = from.rightStart
    into.rightAt = from.rightAt
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

// Where anchor coordinate x lands through a block starting at aLo, ending at
// aHi and landing at atLo, at `scale` mate bp per anchor bp, x clamped to the
// block: a block beside the window answers with the edge facing it.
function mateAt(
  aLo: number,
  aHi: number,
  atLo: number,
  scale: number,
  x: number,
) {
  return atLo + (Math.min(Math.max(x, aLo), aHi) - aLo) * scale
}

function wholeBp({ refName, start, end }: ResolvedSpan) {
  const lo = Math.floor(start)
  return { refName, start: lo, end: Math.max(lo + 1, Math.ceil(end)) }
}

/**
 * Every window's targets and their bins, in one scan of the blocks.
 *
 * Nothing is allocated per block: an object per block measured 51ms a frame at
 * 500k blocks against 5ms for a bare pass, and a second and third pass over the
 * blocks to cut pieces and then map edges through one measured 3x the single
 * scan. Blocks arrive sorted by length, not grouped by contig, so each lookup
 * is a slot per dictionary id; the mate-side slots are allocated per window a
 * block reaches, and a bin per stretch of the mate one is found on.
 */
function scan({
  data,
  windows,
  toMate,
  mateAssembly,
  binned,
}: {
  data: SyntenyFeatureData
  windows: FollowWindow[]
  toMate: boolean
  mateAssembly?: string
  // false puts each target's blocks in one bin, for an answer through the
  // whole contig
  binned: boolean
}) {
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
  const { strands, nameIds } = data
  const unnamedId = unnamedNameId(data.nameDict)
  const windowOfRefNameId = new Int32Array(windowRefNameDictLength).fill(-1)
  for (const [w, id] of windowRefNameIds.entries()) {
    if (id >= 0) {
      windowOfRefNameId[id] = w
    }
  }
  const targetsPerWindow = windows.map(() => [] as Target[])
  const slotsPerWindow = new Array<Int32Array | undefined>(windows.length)
  for (let i = 0; i < refNameIds.length; i++) {
    const w = windowOfRefNameId[refNameIds[i]!] ?? -1
    if (
      w < 0 ||
      (mateAssemblyId !== undefined &&
        mateAssemblyNameIds[i] !== mateAssemblyId)
    ) {
      continue
    }
    const window = windows[w]!
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
        bins: new Map(),
        last: undefined,
      })
    }
    const target = targets[slot - 1]!
    const aLo = starts[i]!
    const aHi = ends[i]!
    const flip = strands[i] === -1
    const atLo = flip ? otherEnds[i]! : otherStarts[i]!
    const atHi = flip ? otherStarts[i]! : otherEnds[i]!
    // the block's part facing the window, on the mate: under the window, its
    // cut; beside it, the edge facing it. An unbinned scan never asks, and
    // skipping it keeps the overview's per-frame cost where it was.
    const scale = binned && aHi > aLo ? (atHi - atLo) / (aHi - aLo) : 0
    const p = binned ? mateAt(aLo, aHi, atLo, scale, window.start) : 0
    const q = binned ? mateAt(aLo, aHi, atLo, scale, window.end) : 0
    const mateLo = Math.min(p, q)
    const key = binned ? Math.floor(mateLo / binWidth(window)) : 0
    let bin = target.last?.key === key ? target.last : target.bins.get(key)
    if (!bin) {
      bin = {
        key,
        overlap: 0,
        mateLo: Number.POSITIVE_INFINITY,
        mateHi: Number.NEGATIVE_INFINITY,
        anchorLo: Number.POSITIVE_INFINITY,
        anchorHi: Number.NEGATIVE_INFINITY,
        startAt: newAccumulator(window.start),
        endAt: newAccumulator(window.end),
      }
      target.bins.set(key, bin)
    }
    target.last = bin
    offer(bin.startAt, aLo, aHi, atLo, atHi)
    offer(bin.endAt, aLo, aHi, atLo, atHi)
    const lo = Math.max(aLo, window.start)
    const hi = Math.min(aHi, window.end)
    // the same `voteEvidence` the multi-way lane and the launch vote with; a
    // block off the window's ends adds nothing
    if (hi > lo) {
      const overlap = voteEvidence(nameIds[i]! !== unnamedId, hi - lo)
      target.overlap += overlap
      if (binned) {
        bin.overlap += overlap
        bin.mateLo = Math.min(bin.mateLo, mateLo)
        bin.mateHi = Math.max(bin.mateHi, p, q)
        bin.anchorLo = Math.min(bin.anchorLo, lo)
        bin.anchorHi = Math.max(bin.anchorHi, hi)
      }
    }
  }
  return targetsPerWindow
}

// two blocks sharing a bin land no further apart on the mate than this, which
// is what lets a piece break only between bins
function binWidth(window: FollowWindow) {
  return Math.max(1, window.end - window.start)
}

// hysteresis, or a fusion breakpoint flips the row between chromosomes on the
// rounding, every frame
function chooseTarget(targets: Target[], incumbentTarget: string | undefined) {
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
  const chosen = preferIncumbent(best, incumbent)
  return chosen && chosen.overlap > 0 ? chosen : undefined
}

// the window's two edges, through the blocks of the bins given
function edgeSpan(
  name: string,
  window: FollowWindow,
  bins: Iterable<Bin>,
): ResolvedSpan | undefined {
  const startAt = newAccumulator(window.start)
  const endAt = newAccumulator(window.end)
  for (const bin of bins) {
    merge(startAt, bin.startAt)
    merge(endAt, bin.endAt)
  }
  const p = resolve(startAt)
  const q = resolve(endAt)
  if (p === undefined || q === undefined) {
    return undefined
  }
  const lo = Math.min(p, q)
  const hi = Math.max(p, q)
  return hi > lo
    ? {
        refName: name,
        start: Math.floor(lo),
        // a zero-width span assembles into an inverted locstring
        end: Math.max(Math.floor(lo) + 1, Math.ceil(hi)),
      }
    : undefined
}

// A piece and the bins it spans
interface Run {
  piece: FollowPiece
  firstKey: number
  lastKey: number
}

/**
 * The target's cut bins in mate order, run together wherever the next starts
 * no further than a window past everything before it: exactly the runs a sort
 * of the cuts would give, since two cuts sharing a bin are never further apart
 * than the window, so a run can only break between bins.
 */
function followRuns(target: Target, window: FollowWindow) {
  const gap = binWidth(window)
  const cut = [...target.bins.values()]
    .filter(b => b.overlap > 0)
    .sort((a, b) => a.key - b.key)
  const runs: Run[] = []
  for (const bin of cut) {
    const last = runs.at(-1)
    if (last && bin.mateLo - last.piece.mate.end <= gap) {
      const { piece } = last
      piece.mate.end = Math.max(piece.mate.end, bin.mateHi)
      piece.anchor.start = Math.min(piece.anchor.start, bin.anchorLo)
      piece.anchor.end = Math.max(piece.anchor.end, bin.anchorHi)
      piece.overlap += bin.overlap
      last.lastKey = bin.key
    } else {
      runs.push({
        piece: {
          mate: { refName: target.name, start: bin.mateLo, end: bin.mateHi },
          anchor: {
            refName: window.refName,
            start: bin.anchorLo,
            end: bin.anchorHi,
          },
          overlap: bin.overlap,
        },
        firstKey: bin.key,
        lastKey: bin.key,
      })
    }
  }
  return runs
}

/**
 * Where each anchor window maps to, across every alignment under it,
 * positionally, `undefined` where nothing under that window mapped. Rung 3's
 * form, every window in one scan of the blocks, and mapped through its whole
 * target contig: an overview places every piece.
 *
 * Each window edge is mapped, not the union of the mapped blocks: the union is
 * a step function, measured as 1 movement in 30 drag steps on grape/peach at
 * 5 Mb.
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
  return scan({
    data,
    windows,
    toMate,
    mateAssembly,
    binned: false,
  }).map((targets, w) => {
    const target = chooseTarget(targets, incumbentTargets?.[w])
    return target
      ? edgeSpan(target.name, windows[w]!, target.bins.values())
      : undefined
  })
}

/**
 * Where one anchor window maps to: rung 2, every case below whole-genome zoom.
 *
 * Mapped through one piece of the target contig, not the whole contig. Two
 * assemblies rearranged within a chromosome put a window's alignments in
 * places tens of Mb apart along the mate, and an edge in unaligned flank takes
 * the nearest block on the contig, however far along the mate it lands; hg38
 * chr6:49-51M answered mm39 chr1:19.5-169M through a 68bp fragment, a span the
 * window's real 1.2 Mb chain sat outside. The heaviest piece places the row,
 * with the incumbent's hysteresis, through the blocks whose part facing the
 * window lands within a window of it; the other notable pieces come back as
 * `elsewhere`.
 */
export function followWindowMapping({
  data,
  window,
  toMate,
  mateAssembly,
  incumbent,
}: {
  data: SyntenyFeatureData
  window: FollowWindow
  toMate: boolean
  mateAssembly?: string
  // where the row was last placed
  incumbent?: ResolvedSpan
}): FollowEnvelope | undefined {
  const [targets = []] = scan({
    data,
    windows: [window],
    toMate,
    mateAssembly,
    binned: true,
  })
  const target = chooseTarget(targets, incumbent?.refName)
  if (!target) {
    return undefined
  }
  const runs = followRuns(target, window)
  let heaviest: FollowPiece | undefined
  let held: FollowPiece | undefined
  for (const { piece } of runs) {
    const { mate, overlap } = piece
    if (!heaviest || overlap > heaviest.overlap) {
      heaviest = piece
    }
    if (
      incumbent?.refName === mate.refName &&
      Math.min(incumbent.end, mate.end) >
        Math.max(incumbent.start, mate.start) &&
      (!held || overlap > held.overlap)
    ) {
      held = piece
    }
  }
  const piece = preferIncumbent(heaviest, held)
  const chosen = runs.find(r => r.piece === piece)
  if (!piece || !chosen) {
    return undefined
  }
  // the piece's own bins, and the window's neighbours facing it from a bin
  // either side, which may also hold the first cut of another piece
  const { firstKey, lastKey } = chosen
  const near = [...target.bins.values()].filter(b =>
    b.overlap > 0
      ? b.key >= firstKey && b.key <= lastKey
      : b.key >= firstKey - 1 && b.key <= lastKey + 1,
  )
  return {
    // a piece whose edges map to one point is not collinear, and the row
    // shows all of it
    span: edgeSpan(target.name, window, near) ?? wholeBp(piece.mate),
    elsewhere: runs
      .filter(
        r => r !== chosen && r.piece.overlap >= piece.overlap * NOTABLE_SHARE,
      )
      .map(r => r.piece)
      .sort((a, b) => b.overlap - a.overlap),
  }
}
