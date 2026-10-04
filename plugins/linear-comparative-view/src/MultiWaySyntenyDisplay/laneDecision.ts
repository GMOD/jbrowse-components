import {
  OUTLIER_REACH,
  keepNearMedian,
  weightedMedian,
} from '../keepNearMedian.ts'
import { NEARLY_ALL, preferIncumbent } from '../syntenyHysteresis.ts'
import {
  frameOpenings,
  groupRunsOnRow,
  laneBpOfOpened,
  laneOpeningsOf,
  openedBp,
  rowFrameX,
} from './layoutMultiWay.ts'

import type {
  FetchRegion,
  LaneOpening,
  MultiWayGroup,
  MultiWayPlacement,
  RowFrame,
} from './layoutMultiWay.ts'

type OpeningsOf = (
  assemblyName: string,
  refName: string,
) => readonly LaneOpening[]

export interface AnchorCoord {
  refName: string
  coord: number
}

/**
 * Holds nothing a pan or zoom changes. `flipped` is against the anchor's
 * order, not the screen.
 */
export interface LaneDecision {
  refName: string
  flipped: boolean
  rung: number
  pivotAnchor: AnchorCoord
  pivotLaneBp: number
  fitMin: number
  fitMax: number
  alsoOn: string[]
  alsoOnMore: number
  /** the reader's pin chose the contig, so it is no incumbent once unpinned */
  pinned: boolean
  orientationPinned: boolean
}

/** `flipped` is against the anchor's order, as `LaneDecision.flipped` is */
export interface LaneFlipPin {
  refName: string
  flipped: boolean
}

/** decisions in `anchor`'s coordinates; `window` is what the view showed */
export interface FrozenLanes {
  anchor: string
  decisions: Record<string, LaneDecision>
  window: FetchRegion[]
}

/** Moves `d`'s content `dxPx` screen px right; its pivot anchor stays put. */
export function nudgeDecision(
  d: LaneDecision,
  dxPx: number,
  bpPerPx: number,
  anchorReversed: boolean,
  openings: readonly LaneOpening[] = [],
): LaneDecision {
  const mirrored = d.flipped !== anchorReversed
  return {
    ...d,
    pivotLaneBp: laneBpOfOpened(
      openings,
      openedBp(openings, d.pivotLaneBp) + (mirrored ? 1 : -1) * dxPx * bpPerPx,
    ),
  }
}

// multiples of the anchor's visible span; rung 1 never zooms in past the anchor
export const SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]

// the share of a lower rung a fit must leave unused before the lane drops to it
const SHRINK_ROOM = 0.85
const MIN_SHARED_FOR_ORIENTATION = 3
// three reversed genes is a small inversion, not a lane reading backwards
const MIN_SHARED_TO_SWITCH = 5
// well under the switch margin, so a copy the lane never picks is still named
const ALSO_ON_SHARE = 0.2
// a polyploid's other copies are a couple; past three it is a scaffold dump
const ALSO_ON_MAX = 3
// relative, since a lane aligned on its median can overhang its frame
const HOLD_COVERAGE = 0.9

function mid(p: MultiWayPlacement) {
  return (p.start + p.end) / 2
}

// a mammal liftOver over a human window runs up to 7.5% wider (TNNT3)
const RUNG_TOLERANCE = 0.1

const rungCovers = (rung: number, need: number) =>
  rung * (1 + RUNG_TOLERANCE) >= need

export function pickRung(need: number, incumbent?: number) {
  const up = SCALE_LADDER.find(r => rungCovers(r, need)) ?? Math.ceil(need)
  if (incumbent === undefined || !rungCovers(incumbent, need)) {
    return up
  }
  const below = SCALE_LADDER.filter(r => r < incumbent).at(-1)
  return below !== undefined && need <= Math.max(below * SHRINK_ROOM, 1)
    ? up
    : incumbent
}

function pickContig(
  groups: MultiWayGroup[],
  assemblyName: string,
  incumbent: string | undefined,
  pinned: string | undefined,
) {
  const byRef = new Map<string, MultiWayPlacement[]>()
  const evidence = new Map<string, number>()
  for (const group of groups) {
    for (const p of group.mates.get(assemblyName) ?? []) {
      let bucket = byRef.get(p.refName)
      if (!bucket) {
        bucket = []
        byRef.set(p.refName, bucket)
      }
      bucket.push(p)
      evidence.set(p.refName, (evidence.get(p.refName) ?? 0) + group.weight)
    }
  }
  let best: { refName: string; overlap: number } | undefined
  for (const [refName, overlap] of evidence) {
    if (!best || overlap > best.overlap) {
      best = { refName, overlap }
    }
  }
  const held =
    incumbent !== undefined && evidence.has(incumbent)
      ? { refName: incumbent, overlap: evidence.get(incumbent)! }
      : undefined
  const chosen =
    pinned !== undefined && evidence.has(pinned)
      ? { refName: pinned, overlap: evidence.get(pinned)! }
      : preferIncumbent(best, held)
  const named = chosen
    ? [...evidence]
        .filter(
          ([refName, overlap]) =>
            refName !== chosen.refName &&
            overlap >= chosen.overlap * ALSO_ON_SHARE,
        )
        .sort((a, b) => b[1] - a[1])
        .map(([refName]) => refName)
    : []
  return (
    chosen && {
      refName: chosen.refName,
      placements: byRef.get(chosen.refName)!,
      alsoOn: named.slice(0, ALSO_ON_MAX),
      alsoOnMore: Math.max(named.length - ALSO_ON_MAX, 0),
    }
  )
}

function fitExtent(
  placements: MultiWayPlacement[],
  unitBp: number,
  incumbentCenter: number | undefined,
) {
  const kept = keepNearMedian(
    placements,
    unitBp > 0 ? unitBp * OUTLIER_REACH : Number.POSITIVE_INFINITY,
    p => p,
    incumbentCenter,
  )
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of kept) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  // no margin: rounding up to a rung is the margin
  return { lo: Math.max(0, min), hi: Math.max(max, min + 1) }
}

function anchorOrderSign(
  groups: MultiWayGroup[],
  assemblyName: string,
  refName: string,
) {
  let sum = 0
  let prev: number | undefined
  for (const group of groups) {
    const p = group.mates.get(assemblyName)?.find(m => m.refName === refName)
    if (p) {
      const m = mid(p)
      if (prev !== undefined) {
        sum += Math.sign(m - prev)
      }
      prev = m
    }
  }
  return sum
}

/** `unitBp` of 0 makes the fitted extent the frame. */
export function computeRowFrame(
  groups: MultiWayGroup[],
  assemblyName: string,
  unitBp = 0,
  incumbent?: FitIncumbent,
): RowFrame | undefined {
  return fitLane(
    groups,
    assemblyName,
    unitBp,
    incumbent,
    undefined,
    laneOpeningsOf(groups),
  )?.frame
}

function withOpenings(frame: RowFrame, openings: readonly LaneOpening[]) {
  return openings.length ? { ...frame, openings } : frame
}

type FitIncumbent = Pick<
  LaneDecision,
  'refName' | 'rung' | 'fitMin' | 'fitMax' | 'pinned'
>

function fitLane(
  groups: MultiWayGroup[],
  assemblyName: string,
  unitBp: number,
  incumbent: FitIncumbent | undefined,
  pinned: string | undefined,
  openingsOf: OpeningsOf,
) {
  const released = incumbent?.pinned && incumbent.refName !== pinned
  const contig = pickContig(
    groups,
    assemblyName,
    released ? undefined : incumbent?.refName,
    pinned,
  )
  if (!contig) {
    return undefined
  }
  const held = incumbent?.refName === contig.refName ? incumbent : undefined
  const { lo, hi } = fitExtent(
    contig.placements,
    unitBp,
    held && (held.fitMin + held.fitMax) / 2,
  )
  const openings = openingsOf(assemblyName, contig.refName)
  const openedLo = openedBp(openings, lo, true)
  const openedHi = Math.max(openedLo + 1, openedBp(openings, hi))
  const rung =
    unitBp > 0
      ? pickRung(Math.max(openedHi - openedLo, unitBp) / unitBp, held?.rung)
      : 0
  const span = unitBp > 0 ? rung * unitBp : openedHi - openedLo
  const min = (openedLo + openedHi) / 2 - span / 2
  return {
    rung,
    pinned: contig.refName === pinned,
    frame: withOpenings(
      {
        refName: contig.refName,
        min,
        max: min + span,
        flipped: anchorOrderSign(groups, assemblyName, contig.refName) < 0,
        fitMin: lo,
        fitMax: hi,
        alsoOn: contig.alsoOn,
        alsoOnMore: contig.alsoOnMore,
      },
      openings,
    ),
  }
}

interface LanePlacement {
  group: MultiWayGroup
  key: string
  center: number
  weight: number
}

function lanePlacements(
  groups: MultiWayGroup[],
  assemblyName: string,
  frame: RowFrame,
): LanePlacement[] {
  const out: LanePlacement[] = []
  for (const group of groups) {
    for (const run of groupRunsOnRow(group, assemblyName, frame)) {
      out.push({
        group,
        key: group.key,
        center: (run.min + run.max) / 2,
        weight: Math.max(run.max - run.min, 1),
      })
    }
  }
  return out
}

function sharedGroupCount(upperX: Map<string, number>, lane: LanePlacement[]) {
  return new Set(lane.filter(p => upperX.has(p.key)).map(p => p.key)).size
}

function lanePlacementXs(
  placements: LanePlacement[],
  frame: RowFrame,
  width: number,
) {
  const heaviest = new Map<string, LanePlacement>()
  for (const p of placements) {
    const held = heaviest.get(p.key)
    if (!held || p.weight > held.weight) {
      heaviest.set(p.key, p)
    }
  }
  return new Map(
    [...heaviest.values()].map(p => [p.key, rowFrameX(frame, p.center, width)]),
  )
}

function orientationVote(upperX: Map<string, number>, lane: LanePlacement[]) {
  const shared = lane
    .filter(p => upperX.has(p.key))
    .sort((a, b) => upperX.get(a.key)! - upperX.get(b.key)!)
  const byKey = new Map<string, LanePlacement[]>()
  for (const p of shared) {
    const runs = byKey.get(p.key)
    if (runs) {
      runs.push(p)
    } else {
      byKey.set(p.key, [p])
    }
  }
  if (byKey.size < MIN_SHARED_FOR_ORIENTATION) {
    return undefined
  }
  let { total, backwards } = weightedPairs(shared)
  for (const runs of byKey.values()) {
    const same = weightedPairs(runs)
    total -= same.total
    backwards -= same.backwards
  }
  const share = total > 0 ? backwards / total : 0.5
  return {
    share,
    shared: byKey.size,
    backwards: share === 0.5 ? undefined : share > 0.5,
  }
}

// A Fenwick tree over the centers' ranks sums the earlier weight below a run.
function weightedPairs(runs: LanePlacement[]) {
  const ranks = [...new Set(runs.map(r => r.center))].sort((a, b) => a - b)
  const rankOf = new Map(ranks.map((center, i) => [center, i + 1]))
  const tree = new Float64Array(ranks.length + 1)
  let seen = 0
  let total = 0
  let backwards = 0
  for (const run of runs) {
    const rank = rankOf.get(run.center)!
    const weight = run.group.weight
    let atOrBelow = 0
    for (let i = rank; i > 0; i -= i & -i) {
      atOrBelow += tree[i]!
    }
    total += weight * seen
    backwards += weight * (seen - atOrBelow)
    for (let i = rank; i < tree.length; i += i & -i) {
      tree[i]! += weight
    }
    seen += weight
  }
  return { total, backwards }
}

function decideOrientation(
  fitted: boolean,
  vote: ReturnType<typeof orientationVote>,
  incumbent: boolean | undefined,
) {
  const held = incumbent ?? fitted
  if (
    vote?.backwards === undefined ||
    vote.backwards === held ||
    vote.shared < MIN_SHARED_TO_SWITCH
  ) {
    return held
  }
  if (incumbent === undefined) {
    return vote.backwards
  }
  const share = vote.backwards ? vote.share : 1 - vote.share
  return share >= NEARLY_ALL ? vote.backwards : incumbent
}

// Unclamped, so part of the fit can fall off an edge and homologs line up.
function alignFrameTo(
  upperX: Map<string, number>,
  lane: LanePlacement[],
  frame: RowFrame,
  width: number,
): RowFrame {
  const samples = lane.flatMap(p => {
    const x = upperX.get(p.key)
    return x === undefined
      ? []
      : [{ value: x - rowFrameX(frame, p.center, width), weight: p.weight }]
  })
  if (!samples.length) {
    return frame
  }
  const shift =
    ((frame.flipped ? 1 : -1) *
      weightedMedian(samples) *
      (frame.max - frame.min)) /
    width
  return { ...frame, min: frame.min + shift, max: frame.max + shift }
}

function weightInside(placements: LanePlacement[], frame: RowFrame) {
  const openings = frameOpenings(frame)
  let inside = 0
  for (const p of placements) {
    const center = openedBp(openings, p.center)
    if (center >= frame.min && center <= frame.max) {
      inside += p.weight
    }
  }
  return inside
}

function laneBpAt(frame: RowFrame, px: number, width: number) {
  const bpPerPx = (frame.max - frame.min) / width
  return laneBpOfOpened(
    frameOpenings(frame),
    frame.flipped
      ? frame.min + (width - px) * bpPerPx
      : frame.min + px * bpPerPx,
  )
}

/** `pivotPx` and `unitBp` are the view's live pivot px and visible span. */
export function frameFromDecision(
  d: LaneDecision,
  pivotPx: number,
  unitBp: number,
  width: number,
  anchorReversed = false,
  openings: readonly LaneOpening[] = [],
): RowFrame {
  const span = d.rung * unitBp
  const bpPerPx = span / width
  const flipped = d.flipped !== anchorReversed
  const pivot = openedBp(openings, d.pivotLaneBp)
  const min = flipped
    ? pivot - (width - pivotPx) * bpPerPx
    : pivot - pivotPx * bpPerPx
  return withOpenings(
    {
      refName: d.refName,
      min,
      max: min + span,
      flipped,
      fitMin: d.fitMin,
      fitMax: d.fitMax,
      alsoOn: d.alsoOn,
      alsoOnMore: d.alsoOnMore,
    },
    openings,
  )
}

export interface DecideLaneFramesOpts {
  groups: MultiWayGroup[]
  assemblyNames: string[]
  // px of each group's centre on the anchor lane
  anchorX: Map<string, number>
  anchorCoordOf: (group: MultiWayGroup) => AnchorCoord
  pxOfAnchor: (coord: AnchorCoord) => number | undefined
  unitBp: number
  width: number
  anchorReversed?: boolean
  previous: ReadonlyMap<string, LaneDecision | undefined>
  pinned?: ReadonlyMap<string, string>
  pinnedFlips?: ReadonlyMap<string, LaneFlipPin>
  frozen?: ReadonlyMap<string, LaneDecision>
  /** read off every fetched group, so a hole does not wait on the viewport */
  openingsOf?: OpeningsOf
}

function sameDecision(a: LaneDecision, b: LaneDecision) {
  return (
    a.refName === b.refName &&
    a.pinned === b.pinned &&
    a.orientationPinned === b.orientationPinned &&
    a.flipped === b.flipped &&
    a.rung === b.rung &&
    a.pivotLaneBp === b.pivotLaneBp &&
    a.pivotAnchor.refName === b.pivotAnchor.refName &&
    a.pivotAnchor.coord === b.pivotAnchor.coord &&
    a.fitMin === b.fitMin &&
    a.fitMax === b.fitMax &&
    a.alsoOnMore === b.alsoOnMore &&
    a.alsoOn.length === b.alsoOn.length &&
    a.alsoOn.every((name, i) => name === b.alsoOn[i])
  )
}

/**
 * A lane that held returns its previous object, so a caller compares by
 * identity.
 */
export function decideLaneFrames({
  groups,
  assemblyNames,
  anchorX,
  anchorCoordOf,
  pxOfAnchor,
  unitBp,
  width,
  anchorReversed = false,
  previous,
  pinned,
  pinnedFlips,
  frozen,
  openingsOf = laneOpeningsOf(groups),
}: DecideLaneFramesOpts) {
  const out = new Map<string, LaneDecision | undefined>()
  let upperX = anchorX
  for (const [i, assemblyName] of assemblyNames.entries()) {
    const kept = frozen?.get(assemblyName)
    const keptPx = kept && pxOfAnchor(kept.pivotAnchor)
    if (kept && keptPx !== undefined && unitBp > 0 && width > 0) {
      out.set(assemblyName, kept)
      if (i + 1 < assemblyNames.length) {
        const frame = frameFromDecision(
          kept,
          keptPx,
          unitBp,
          width,
          anchorReversed,
          openingsOf(assemblyName, kept.refName),
        )
        upperX = lanePlacementXs(
          lanePlacements(groups, assemblyName, frame),
          frame,
          width,
        )
      }
      continue
    }
    const prev = previous.get(assemblyName)
    const fit = fitLane(
      groups,
      assemblyName,
      unitBp,
      prev,
      pinned?.get(assemblyName),
      openingsOf,
    )
    if (fit === undefined || unitBp <= 0 || width <= 0) {
      out.set(assemblyName, undefined)
      continue
    }
    const { rung, pinned: onPin, frame: fitted } = fit
    const placements = lanePlacements(groups, assemblyName, fitted)
    const reference =
      sharedGroupCount(upperX, placements) >= MIN_SHARED_FOR_ORIENTATION
        ? upperX
        : anchorX
    // the vote reads screen px; the decision is against the anchor's order
    const vote = orientationVote(reference, placements)
    const voted = decideOrientation(
      fitted.flipped,
      vote && {
        shared: vote.shared,
        share: anchorReversed ? 1 - vote.share : vote.share,
        backwards:
          vote.backwards === undefined
            ? undefined
            : vote.backwards !== anchorReversed,
      },
      prev?.orientationPinned ? undefined : prev?.flipped,
    )
    const flipPin = pinnedFlips?.get(assemblyName)
    const orientationPinned = flipPin?.refName === fitted.refName
    const relativeFlipped = orientationPinned ? flipPin.flipped : voted
    const oriented = { ...fitted, flipped: relativeFlipped !== anchorReversed }
    const aligned = alignFrameTo(reference, placements, oriented, width)

    let decision: LaneDecision | undefined
    const held =
      prev &&
      prev.refName === aligned.refName &&
      prev.flipped === relativeFlipped
        ? prev
        : undefined
    const heldPx = held && pxOfAnchor(held.pivotAnchor)
    if (held && heldPx !== undefined) {
      const carried = {
        ...held,
        rung,
        pinned: onPin,
        orientationPinned,
        fitMin: aligned.fitMin,
        fitMax: aligned.fitMax,
        alsoOn: aligned.alsoOn,
        alsoOnMore: aligned.alsoOnMore,
      }
      const heldFrame = frameFromDecision(
        carried,
        heldPx,
        unitBp,
        width,
        anchorReversed,
        frameOpenings(aligned),
      )
      if (
        weightInside(placements, heldFrame) >=
        HOLD_COVERAGE * weightInside(placements, aligned)
      ) {
        decision = sameDecision(held, carried) ? held : carried
      }
    }
    if (!decision) {
      const pivot = placements
        .map(p => ({ group: p.group, x: anchorX.get(p.key) }))
        .filter(
          (p): p is { group: MultiWayGroup; x: number } => p.x !== undefined,
        )
        .sort(
          (a, b) => Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2),
        )[0]
      const group = pivot?.group
      const pivotPx = group && pxOfAnchor(anchorCoordOf(group))
      if (group && pivotPx !== undefined) {
        decision = {
          refName: aligned.refName,
          flipped: relativeFlipped,
          rung,
          pivotAnchor: anchorCoordOf(group),
          pivotLaneBp: laneBpAt(aligned, pivotPx, width),
          fitMin: aligned.fitMin,
          fitMax: aligned.fitMax,
          alsoOn: aligned.alsoOn,
          alsoOnMore: aligned.alsoOnMore,
          pinned: onPin,
          orientationPinned,
        }
        if (prev && sameDecision(prev, decision)) {
          decision = prev
        }
      }
    }
    out.set(assemblyName, decision)
    if (i + 1 < assemblyNames.length) {
      const frame = decision
        ? frameFromDecision(
            decision,
            pxOfAnchor(decision.pivotAnchor)!,
            unitBp,
            width,
            anchorReversed,
            frameOpenings(aligned),
          )
        : aligned
      upperX = lanePlacementXs(
        lanePlacements(groups, assemblyName, frame),
        frame,
        width,
      )
    }
  }
  return out
}

export function sameDecisions(
  a: ReadonlyMap<string, LaneDecision | undefined>,
  b: ReadonlyMap<string, LaneDecision | undefined>,
) {
  if (a.size !== b.size) {
    return false
  }
  for (const [key, value] of a) {
    if (!b.has(key) || b.get(key) !== value) {
      return false
    }
  }
  return true
}
