import { clamp } from '@jbrowse/core/util'

import {
  OUTLIER_REACH,
  keepNearMedian,
  weightedMedian,
} from '../keepNearMedian.ts'
import { NEARLY_ALL, preferIncumbent } from '../syntenyHysteresis.ts'
import { groupRunsOnRow, rowFrameX } from './layoutMultiWay.ts'

import type {
  MultiWayGroup,
  MultiWayPlacement,
  RowFrame,
} from './layoutMultiWay.ts'

export interface AnchorCoord {
  refName: string
  coord: number
}

/**
 * What a settle decides about one mate lane, and nothing that a pan or a zoom
 * changes. The frame the lane draws in is derived from this against the live
 * view: `pivotLaneBp` sits wherever the view draws `pivotAnchor`, at `rung`
 * times the view's bp-per-pixel, so the lane translates and scales with the
 * anchor between decisions and its ribbons stay rigid. `flipped` is against
 * the anchor's ORDER, so a horizontally flipped view mirrors the lane with it
 * and decides nothing.
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
}

// The scales a lane's frame is allowed to sit at, as multiples of the anchor's
// visible span. Fitting a lane exactly to its placements gives it an arbitrary
// bp/px that also MOVES: one more ortholog entering the window re-fits the
// frame, so the lane's content slides under its own ribbons on every pan. The
// first rung is the "never zoom in past the anchor" clamp.
export const SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]

// a lane drops to a lower rung only once its fit leaves this much of that rung
// unused, so a fit hovering at a rung boundary does not rescale on every step
const SHRINK_ROOM = 0.85
const MIN_SHARED_FOR_ORIENTATION = 3
// the groups a lane's mirror vote has to be measured over, since three genes
// all reversed is one small inversion and not a lane reading backwards; the
// share it needs is the follow's `NEARLY_ALL`
const MIN_SHARED_TO_SWITCH = 5
// a contig explaining at least this share of what the drawn one explains is
// named beside the lane rather than dropped: a genome holding two homoeologous
// copies of the anchor window shows one, and the other is the reader's to ask
// for. Well under the switch margin, so a copy the lane will never choose on
// its own is still named.
const ALSO_ON_SHARE = 0.5
// a lane keeps its placement while its frame still shows this much of the
// placed weight: content that came in with the anchor is drawn where it
// arrived, and the lane re-aligns only once what it should show has left it
const HOLD_COVERAGE = 0.9

function mid(p: MultiWayPlacement) {
  return (p.start + p.end) / 2
}

export function pickRung(need: number, incumbent?: number) {
  const up = SCALE_LADDER.find(r => r >= need) ?? Math.ceil(need)
  if (incumbent === undefined || incumbent < need) {
    return up
  }
  const below = SCALE_LADDER.filter(r => r < incumbent).at(-1)
  return below !== undefined && need <= below * SHRINK_ROOM ? up : incumbent
}

function pickContig(
  groups: MultiWayGroup[],
  assemblyName: string,
  incumbent: string | undefined,
  pinned: string | undefined,
) {
  const byRef = new Map<string, MultiWayPlacement[]>()
  const anchorBp = new Map<string, number>()
  for (const group of groups) {
    const weight = Math.max(group.anchor.end - group.anchor.start, 1)
    for (const p of group.mates.get(assemblyName) ?? []) {
      let bucket = byRef.get(p.refName)
      if (!bucket) {
        bucket = []
        byRef.set(p.refName, bucket)
      }
      bucket.push(p)
      anchorBp.set(p.refName, (anchorBp.get(p.refName) ?? 0) + weight)
    }
  }
  let best: { refName: string; overlap: number } | undefined
  for (const [refName, overlap] of anchorBp) {
    if (!best || overlap > best.overlap) {
      best = { refName, overlap }
    }
  }
  const held =
    incumbent !== undefined && anchorBp.has(incumbent)
      ? { refName: incumbent, overlap: anchorBp.get(incumbent)! }
      : undefined
  // a pin is the reader's choice and outranks the vote, for as long as the
  // window still places anything on it
  const chosen =
    pinned !== undefined && anchorBp.has(pinned)
      ? { refName: pinned, overlap: anchorBp.get(pinned)! }
      : preferIncumbent(best, held)
  return (
    chosen && {
      refName: chosen.refName,
      placements: byRef.get(chosen.refName)!,
      alsoOn: [...anchorBp]
        .filter(
          ([refName, overlap]) =>
            refName !== chosen.refName &&
            overlap >= chosen.overlap * ALSO_ON_SHARE,
        )
        .sort((a, b) => b[1] - a[1])
        .map(([refName]) => refName),
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
  const pad = Math.max((max - min) * 0.02, 1)
  return { lo: Math.max(0, min - pad), hi: max + pad }
}

// which way the lane's placements run against the anchor's order, as the sign
// sum every lane can answer on its own — the fallback where the vote against
// the lane above abstains
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

/**
 * A lane fitted on its own: the contig explaining the most anchor bp, the
 * extent of the placements near their median, the anchor-order orientation,
 * and a ladder rung over the extent, centred on it. `unitBp` of 0 means the
 * caller has no anchor span to scale against and the fitted extent is the
 * frame. What the settle decision starts from, and what a test or a probe
 * asks when it wants the fit without the chain.
 */
export function computeRowFrame(
  groups: MultiWayGroup[],
  assemblyName: string,
  unitBp = 0,
  incumbent?: FitIncumbent,
): RowFrame | undefined {
  return fitLane(groups, assemblyName, unitBp, incumbent, undefined)?.frame
}

type FitIncumbent = Pick<LaneDecision, 'refName' | 'rung' | 'fitMin' | 'fitMax'>

function fitLane(
  groups: MultiWayGroup[],
  assemblyName: string,
  unitBp: number,
  incumbent: FitIncumbent | undefined,
  pinned: string | undefined,
) {
  const contig = pickContig(groups, assemblyName, incumbent?.refName, pinned)
  if (!contig) {
    return undefined
  }
  const held = incumbent?.refName === contig.refName ? incumbent : undefined
  const { lo, hi } = fitExtent(
    contig.placements,
    unitBp,
    held && (held.fitMin + held.fitMax) / 2,
  )
  const rung =
    unitBp > 0 ? pickRung(Math.max(hi - lo, unitBp) / unitBp, held?.rung) : 0
  const span = unitBp > 0 ? rung * unitBp : hi - lo
  const min = Math.max(0, (lo + hi) / 2 - span / 2)
  return {
    rung,
    frame: {
      refName: contig.refName,
      min,
      max: min + span,
      flipped: anchorOrderSign(groups, assemblyName, contig.refName) < 0,
      fitMin: lo,
      fitMax: hi,
      alsoOn: contig.alsoOn,
    },
  }
}

interface LanePlacement {
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
    const runs = groupRunsOnRow(group, assemblyName, frame)
    if (runs.length) {
      const min = runs[0]!.min
      const max = runs.at(-1)!.max
      out.push({
        key: group.key,
        center: (min + max) / 2,
        weight: Math.max(max - min, 1),
      })
    }
  }
  return out
}

// how the lane's shared groups run against the lane above: the share of the
// paired weight reading backwards, and the majority it makes. Undefined on
// fewer than three shared groups, or a tie
function orientationVote(upperX: Map<string, number>, lane: LanePlacement[]) {
  const shared = lane
    .filter(p => upperX.has(p.key))
    .sort((a, b) => upperX.get(a.key)! - upperX.get(b.key)!)
  if (shared.length < MIN_SHARED_FOR_ORIENTATION) {
    return undefined
  }
  let backwards = 0
  let total = 0
  for (let i = 1; i < shared.length; i++) {
    const a = shared[i - 1]!
    const b = shared[i]!
    const w = Math.min(a.weight, b.weight)
    total += w
    if (b.center < a.center) {
      backwards += w
    }
  }
  const share = total > 0 ? backwards / total : 0.5
  return {
    share,
    shared: shared.length,
    backwards: share === 0.5 ? undefined : share > 0.5,
  }
}

// A lane keeps reading the way it did — across a contig change too, since the
// anchor-order sum a fresh lane falls back on is the noisiest vote there is —
// until nearly all of enough shared groups read the other way.
function decideOrientation(
  fitted: boolean,
  vote: ReturnType<typeof orientationVote>,
  incumbent: boolean | undefined,
) {
  if (incumbent === undefined) {
    return vote?.backwards ?? fitted
  }
  if (
    vote?.backwards === undefined ||
    vote.backwards === incumbent ||
    vote.shared < MIN_SHARED_TO_SWITCH
  ) {
    return incumbent
  }
  const share = vote.backwards ? vote.share : 1 - vote.share
  return share >= NEARLY_ALL ? vote.backwards : incumbent
}

// the frame slid so its shared groups sit under the lane above's, by the
// weighted median displacement, as far as the rung's room over the fit allows
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
  const span = frame.max - frame.min
  const shift = clamp(
    ((frame.flipped ? 1 : -1) * weightedMedian(samples) * span) / width,
    Math.max(Math.min(0, frame.fitMax - frame.max), -frame.min),
    Math.max(0, frame.fitMin - frame.min),
  )
  return { ...frame, min: frame.min + shift, max: frame.max + shift }
}

function coverageOf(placements: LanePlacement[], min: number, max: number) {
  let inside = 0
  let total = 0
  for (const p of placements) {
    total += p.weight
    if (p.center >= min && p.center <= max) {
      inside += p.weight
    }
  }
  return total > 0 ? inside / total : 0
}

function laneBpAt(frame: RowFrame, px: number, width: number) {
  const bpPerPx = (frame.max - frame.min) / width
  return frame.flipped
    ? frame.min + (width - px) * bpPerPx
    : frame.min + px * bpPerPx
}

/**
 * The frame a decision draws in, against where the view puts its pivot now.
 * `pivotPx` is the view's px for `pivotAnchor` and `unitBp` the view's
 * visible span, both live — so the same decision answers a different frame on
 * every pan and zoom, and that difference is exactly the anchor's own motion.
 */
export function frameFromDecision(
  d: LaneDecision,
  pivotPx: number,
  unitBp: number,
  width: number,
  anchorReversed = false,
): RowFrame {
  const span = d.rung * unitBp
  const bpPerPx = span / width
  const flipped = d.flipped !== anchorReversed
  const min = flipped
    ? d.pivotLaneBp - (width - pivotPx) * bpPerPx
    : d.pivotLaneBp - pivotPx * bpPerPx
  return {
    refName: d.refName,
    min,
    max: min + span,
    flipped,
    fitMin: d.fitMin,
    fitMax: d.fitMax,
    alsoOn: d.alsoOn,
  }
}

export interface DecideLaneFramesOpts {
  groups: MultiWayGroup[]
  assemblyNames: string[]
  // where the anchor lane draws each group's centre, in the px space every
  // lane is aligned in — the first link of the chain
  anchorX: Map<string, number>
  anchorCoordOf: (group: MultiWayGroup) => AnchorCoord
  // the same px space's answer for an arbitrary anchor coordinate, which is
  // how an incumbent's pivot is placed for comparison
  pxOfAnchor: (coord: AnchorCoord) => number | undefined
  unitBp: number
  width: number
  // the anchor axis reads right to left: a decision's `flipped` is relative
  // to the anchor's order, so the screen orientation is the two together
  anchorReversed?: boolean
  previous: ReadonlyMap<string, LaneDecision | undefined>
  // the contig the reader pinned each lane onto, which outranks its vote
  pinned?: ReadonlyMap<string, string>
}

function sameDecision(a: LaneDecision, b: LaneDecision) {
  return (
    a.refName === b.refName &&
    a.flipped === b.flipped &&
    a.rung === b.rung &&
    a.pivotLaneBp === b.pivotLaneBp &&
    a.pivotAnchor.refName === b.pivotAnchor.refName &&
    a.pivotAnchor.coord === b.pivotAnchor.coord &&
    a.fitMin === b.fitMin &&
    a.fitMax === b.fitMax &&
    a.alsoOn.length === b.alsoOn.length &&
    a.alsoOn.every((name, i) => name === b.alsoOn[i])
  )
}

/**
 * One settle's decision for every mate lane, top down, each aligned to the
 * lane above and each holding what it decided last time unless the evidence
 * clearly moved: the contig by the follow's switch margin, the orientation by
 * its deadband, the rung by the shrink room, and the placement by what its
 * frame still covers — the pivot across a rung change too, since a zoom is a
 * scale about it and not a relocation. A lane that held returns its previous
 * object, so a caller can tell a re-decision that changed nothing from one
 * that did.
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
}: DecideLaneFramesOpts) {
  const out = new Map<string, LaneDecision | undefined>()
  let upperX = anchorX
  for (const assemblyName of assemblyNames) {
    const prev = previous.get(assemblyName)
    const fit = fitLane(
      groups,
      assemblyName,
      unitBp,
      prev,
      pinned?.get(assemblyName),
    )
    if (fit === undefined || unitBp <= 0 || width <= 0) {
      out.set(assemblyName, undefined)
      continue
    }
    const { rung, frame: fitted } = fit
    const placements = lanePlacements(groups, assemblyName, fitted)
    // the vote reads screen px, so it comes back in screen terms; the
    // decision is stated against the anchor's order
    const vote = orientationVote(upperX, placements)
    const relativeFlipped = decideOrientation(
      fitted.flipped,
      vote && {
        shared: vote.shared,
        share: anchorReversed ? 1 - vote.share : vote.share,
        backwards:
          vote.backwards === undefined
            ? undefined
            : vote.backwards !== anchorReversed,
      },
      prev?.flipped,
    )
    const oriented = { ...fitted, flipped: relativeFlipped !== anchorReversed }
    const aligned = alignFrameTo(upperX, placements, oriented, width)

    let decision: LaneDecision | undefined
    // the pivot carries across a rung change too: a zoom scales the lane
    // about it, and only the content leaving the frame re-aligns the lane
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
        fitMin: aligned.fitMin,
        fitMax: aligned.fitMax,
        alsoOn: aligned.alsoOn,
      }
      const heldFrame = frameFromDecision(
        carried,
        heldPx,
        unitBp,
        width,
        anchorReversed,
      )
      if (
        coverageOf(placements, heldFrame.min, heldFrame.max) >= HOLD_COVERAGE
      ) {
        decision = sameDecision(held, carried) ? held : carried
      }
    }
    if (!decision) {
      const pivot = placements
        .map(p => ({ key: p.key, x: anchorX.get(p.key) }))
        .filter((p): p is { key: string; x: number } => p.x !== undefined)
        .sort(
          (a, b) => Math.abs(a.x - width / 2) - Math.abs(b.x - width / 2),
        )[0]
      const group = pivot && groups.find(g => g.key === pivot.key)
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
        }
        if (prev && sameDecision(prev, decision)) {
          decision = prev
        }
      }
    }
    out.set(assemblyName, decision)
    const frame = decision
      ? frameFromDecision(
          decision,
          pxOfAnchor(decision.pivotAnchor)!,
          unitBp,
          width,
          anchorReversed,
        )
      : aligned
    upperX = new Map(
      lanePlacements(groups, assemblyName, frame).map(p => [
        p.key,
        rowFrameX(frame, p.center, width),
      ]),
    )
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
