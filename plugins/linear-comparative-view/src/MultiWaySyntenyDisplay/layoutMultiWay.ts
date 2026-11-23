import { clamp, doesIntersect2 } from '@jbrowse/core/util'

import { cutAlignment } from '../mateBpAt.ts'
import { voteEvidence } from '../syntenyHysteresis.ts'
import {
  getMate,
  getMates,
  isArrayRecord,
  isNamedRecord,
} from '../syntenyMate.ts'
import { NO_OPS } from './alignmentOps.ts'
import { isCopyLane, laneGenome } from './copyLane.ts'
import { forEachLaneGap } from './laneGaps.ts'

import type { SyntenyGroupedMate } from '../syntenyMate.ts'
import type { AlignmentOpsById } from './alignmentOps.ts'
import type { LanePiece } from './laneGaps.ts'
import type { Feature } from '@jbrowse/core/util'

export type Span = readonly [number, number]

export interface FetchRegion {
  assemblyName: string
  refName: string
  start: number
  end: number
}

export function mergeContiguousRegions(blocks: FetchRegion[]) {
  const merged: FetchRegion[] = []
  for (const block of blocks) {
    const last = merged.at(-1)
    const abuts =
      last !== undefined &&
      last.assemblyName === block.assemblyName &&
      last.refName === block.refName &&
      (last.end === block.start || block.end === last.start)
    if (last !== undefined && abuts) {
      last.start = Math.min(last.start, block.start)
      last.end = Math.max(last.end, block.end)
    } else {
      merged.push({
        assemblyName: block.assemblyName,
        refName: block.refName,
        start: block.start,
        end: block.end,
      })
    }
  }
  return merged.map(region => ({
    ...region,
    start: Math.floor(region.start),
    end: Math.ceil(region.end),
  }))
}

export interface MultiWayPlacement {
  refName: string
  start: number
  end: number
  name?: string
  /** the source rows stating the placement, where the source keeps rows */
  rows?: readonly number[]
}

/**
 * `orientation` is the pair's strand, never the mate object's own `strand`;
 * -1 twists the ribbon.
 */
export interface MatePlacement extends MultiWayPlacement {
  orientation: number
  /** the pair's own row, which can differ from the group's `feature` */
  feature: Feature
}

/**
 * What a lane draws a group from. A group without `anchor` is a gene-table row
 * the anchor genome lacks: it joins the lanes that carry it, and the frames,
 * the vote and the holes never read it.
 */
export interface PlacedGroup {
  key: string
  anchor?: MultiWayPlacement
  mates: Map<string, MatePlacement[]>
  feature: Feature
}

export interface MultiWayGroup extends PlacedGroup {
  anchor: MultiWayPlacement
  /** contig-vote evidence: anchor bp for an alignment, 1 for a named gene */
  weight: number
}

/** make-pif --coarse's 10 kb bound, so the cut lands alike on either tier */
export const SPLIT_AT_GAP_BP = 10_000

/**
 * `bp` of the anchor that the lane's sequence lacks at `at`: a deletion its
 * alignment carries. The frame opens a hole there, so what follows sits under
 * its own anchor position and every lane carrying the deletion shows it alike.
 */
export interface LaneOpening {
  at: number
  bp: number
}

/**
 * What a lane's records state over lane bp `at` to `laneEnd`: across a gap
 * between two pieces, `anchorBp` of anchor no piece between them holds against
 * the `laneBp` of the gap no piece holds, the lane's own, a deletion where the
 * lane's side is 0, an insertion where the anchor's is, and one replaced by
 * the other where both have bases; or an inverted run holding `anchorBp` of
 * anchor over `laneBp` of lane. `anchor` is where it sits on the anchor: the
 * stretch replaced or inverted, or the point of an insertion. A side holding
 * no bp may span its whole gap.
 */
export interface LaneChange {
  at: number
  laneEnd: number
  laneBp: number
  anchorBp: number
  kind: 'deletion' | 'insertion' | 'replacement' | 'inversion'
  anchor: AnchorStretch
}

interface AnchorStretch {
  refName: string
  start: number
  end: number
}

/**
 * An array record over lane bp `at` to `at + laneBp`: the lane walks the
 * sequence it holds about `laneWalks` times and the anchor about
 * `anchorWalks`, over `anchorBp` of anchor, and no copy is paired with one
 */
export interface LaneRepeat {
  at: number
  laneBp: number
  anchorBp: number
  laneWalks: number
  anchorWalks: number
  anchor: AnchorStretch
}

function walksOf(feature: Feature, field: string) {
  const walks: unknown = feature.get(field)
  return typeof walks === 'number' ? walks : 0
}

interface LaneRun {
  orientation: number
  refName: string
  laneStart: number
  laneEnd: number
  anchorStart: number
  anchorEnd: number
  anchors: { start: number; end: number }[]
}

/**
 * A lane contig's pieces as runs of one strand, a piece nested inside a
 * longer one set aside as `forEachLaneGap` does, so a paralog hit inside a
 * segdup splits no run. An array record is no run and parts the runs either
 * side of it into separate stretches, since it pairs no copy with the anchor.
 */
function laneRunsOf(sorted: readonly PlacedPiece[]) {
  const stretches: LaneRun[][] = [[]]
  let reach = Number.NEGATIVE_INFINITY
  for (const { lane, anchor } of sorted) {
    const runs = stretches.at(-1)!
    if (lane.end > reach && isArrayRecord(lane.feature)) {
      reach = lane.end
      stretches.push([])
    } else if (lane.end > reach) {
      reach = lane.end
      const last = runs.at(-1)
      if (
        last?.orientation === lane.orientation &&
        last.refName === anchor.refName
      ) {
        last.laneEnd = Math.max(last.laneEnd, lane.end)
        last.anchorStart = Math.min(last.anchorStart, anchor.start)
        last.anchorEnd = Math.max(last.anchorEnd, anchor.end)
        last.anchors.push(anchor)
      } else {
        runs.push({
          orientation: lane.orientation,
          refName: anchor.refName,
          laneStart: lane.start,
          laneEnd: lane.end,
          anchorStart: anchor.start,
          anchorEnd: anchor.end,
          anchors: [anchor],
        })
      }
    }
  }
  return stretches
}

function mergedSpans(pieces: readonly { start: number; end: number }[]) {
  const merged: { start: number; end: number }[] = []
  for (const { start, end } of pieces.toSorted((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end)
    } else {
      merged.push({ start, end })
    }
  }
  return merged
}

/** bp of `spans` inside `within`, each base counted once */
function coveredBp(
  spans: readonly { start: number; end: number }[],
  within: readonly { start: number; end: number }[],
) {
  const a = mergedSpans(spans)
  const b = mergedSpans(within)
  let bp = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const x = a[i]!
    const y = b[j]!
    bp += Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start))
    if (x.end < y.end) {
      i++
    } else {
      j++
    }
  }
  return bp
}

/**
 * The runs bounding `runs[i]` as an inversion: the nearest of the other
 * strand on each side, of its refName, with its anchor span between their
 * outer ends. With `widen`, a bound moves out past the next run of the
 * other strand on whichever side the run's anchor sticks out, so long as
 * every run skipped lies between the bounds too, which lets an inversion
 * hold another nested in it.
 */
function flanksOf(runs: readonly LaneRun[], i: number, widen: boolean) {
  const run = runs[i]!
  const passable = (r: LaneRun | undefined) =>
    r?.orientation === run.orientation && r.refName === run.refName
  let a = i - 1
  let b = i + 1
  let skippedStart = Number.POSITIVE_INFINITY
  let skippedEnd = Number.NEGATIVE_INFINITY
  let flanks: { left: LaneRun; right: LaneRun } | undefined
  let searching = true
  while (searching) {
    const left = runs[a]
    const right = runs[b]
    if (
      left &&
      right &&
      left.orientation !== run.orientation &&
      right.orientation !== run.orientation &&
      left.refName === run.refName &&
      right.refName === run.refName
    ) {
      const [lo, hi] =
        left.orientation > 0
          ? [left.anchorStart, right.anchorEnd]
          : [right.anchorStart, left.anchorEnd]
      if (skippedStart < lo || skippedEnd > hi) {
        searching = false
      } else if (run.anchorStart >= lo && run.anchorEnd <= hi) {
        searching = false
        flanks = { left, right }
      } else if (widen) {
        const growLeft =
          left.orientation > 0 ? run.anchorStart < lo : run.anchorEnd > hi
        const skip = (r: LaneRun) => {
          skippedStart = Math.min(skippedStart, r.anchorStart)
          skippedEnd = Math.max(skippedEnd, r.anchorEnd)
        }
        if (growLeft) {
          do {
            skip(runs[a]!)
            a--
          } while (passable(runs[a]))
        } else {
          do {
            skip(runs[b]!)
            b++
          } while (passable(runs[b]))
        }
      } else {
        searching = false
      }
    } else {
      searching = false
    }
  }
  return flanks
}

/**
 * Inversions: a run of the other strand from its stretch's two ends, bounded
 * by runs of their strand (`flanksOf`), with its anchor span mostly outside
 * what those bounds cover, sized by the anchor it holds. A segdup-flanked
 * breakpoint (8p23.1's REPD and REPP) puts paralog hits at the flanks' inner
 * ends, which is why the test reads their outer ends. A reverse hit elsewhere
 * on the anchor, or an inverted copy of a flank, is no inversion; neither the
 * vote nor the drawn direction enters. Where a stretch's ends differ in
 * strand, a run of either strand can be one, bounded by its two neighbours
 * alone. Inversions whose runs hold a shared anchor base are one, the one
 * holding the most anchor, the earlier in the lane on a tie. A run and its
 * bounds lie in one stretch between array records.
 */
function laneInversionsOf(sorted: readonly PlacedPiece[]) {
  const found: { change: LaneChange; anchors: LaneRun['anchors'] }[] = []
  for (const runs of laneRunsOf(sorted)) {
    const endStrand = runs[0]?.orientation
    const endsAgree = endStrand === runs.at(-1)?.orientation
    for (let i = 1; i < runs.length - 1; i++) {
      const run = runs[i]!
      const held = coveredBp(run.anchors, run.anchors)
      const flanks =
        held >= SPLIT_AT_GAP_BP && (!endsAgree || run.orientation !== endStrand)
          ? flanksOf(runs, i, endsAgree)
          : undefined
      if (
        flanks &&
        coveredBp(
          [...flanks.left.anchors, ...flanks.right.anchors],
          run.anchors,
        ) <
          held / 2
      ) {
        found.push({
          change: {
            at: run.laneStart,
            laneEnd: run.laneEnd,
            laneBp: run.laneEnd - run.laneStart,
            anchorBp: held,
            kind: 'inversion',
            anchor: {
              refName: run.refName,
              start: run.anchorStart,
              end: run.anchorEnd,
            },
          },
          anchors: run.anchors,
        })
      }
    }
  }
  const kept: typeof found = []
  for (const inversion of found.toSorted(
    (a, b) =>
      b.change.anchorBp - a.change.anchorBp || a.change.at - b.change.at,
  )) {
    if (
      !kept.some(
        other =>
          other.change.anchor.refName === inversion.change.anchor.refName &&
          coveredBp(other.anchors, inversion.anchors) > 0,
      )
    ) {
      kept.push(inversion)
    }
  }
  return found.filter(f => kept.includes(f)).map(f => f.change)
}

const NO_OPENINGS: readonly LaneOpening[] = []
const NO_CHANGES: readonly LaneChange[] = []
const NO_REPEATS: readonly LaneRepeat[] = []

/** a stretch of a lane's contig, in lane bp */
export interface LaneBlock {
  start: number
  end: number
}

/**
 * `min` and `max` are in the opened coordinate, the lane's bp plus every
 * opening before it, which is the lane's bp wherever it has no openings.
 */
export interface RowFrame {
  refName: string
  min: number
  max: number
  flipped: boolean
  // the fitted extent before the ladder rounded it; it can fall past min/max
  fitMin: number
  fitMax: number
  alsoOn: string[]
  alsoOnMore: number
  /** other blocks of the contig the lane places a comparable share on */
  alsoAt: LaneBlock[]
  openings?: readonly LaneOpening[]
  morphFrom?: readonly { frame: RowFrame; weight: number }[]
}

/** An interval's start at an opening sits after the hole, all else before. */
export function openedBp(
  openings: readonly LaneOpening[],
  bp: number,
  intervalStart = false,
) {
  let out = bp
  for (const { at, bp: hole } of openings) {
    if (at < bp || (intervalStart && at === bp)) {
      out += hole
    } else {
      break
    }
  }
  return out
}

/**
 * A lane point: a lane bp, and how far into the hole opening there it sits,
 * since a hole holds no lane bp of its own
 */
interface LanePoint {
  bp: number
  inHole: number
}

/** The lane point at an opened coordinate. */
export function lanePointOfOpened(
  openings: readonly LaneOpening[],
  at: number,
): LanePoint {
  let shift = 0
  for (const opening of openings) {
    if (at <= opening.at + shift) {
      break
    }
    if (at <= opening.at + shift + opening.bp) {
      return { bp: opening.at, inHole: at - opening.at - shift }
    }
    shift += opening.bp
  }
  return { bp: at - shift, inHole: 0 }
}

/** The lane bp at an opened coordinate; inside a hole, the hole's own `at`. */
export function laneBpOfOpened(openings: readonly LaneOpening[], at: number) {
  return lanePointOfOpened(openings, at).bp
}

/** `lanePointOfOpened`'s inverse, held to the hole at `bp`, or none. */
export function openedOfLanePoint(
  openings: readonly LaneOpening[],
  { bp, inHole }: LanePoint,
) {
  const hole = inHole > 0 ? openings.find(o => o.at === bp) : undefined
  return openedBp(openings, bp) + (hole ? Math.min(inHole, hole.bp) : 0)
}

export function frameOpenings(frame: RowFrame) {
  return frame.openings ?? NO_OPENINGS
}

function oneRecord(left: MatePlacement, right: MatePlacement) {
  const record: unknown = left.feature.get('recordId')
  return record !== undefined && record === right.feature.get('recordId')
}

// Between two fetch windows lies anchor the fetch never read
function oneWindow(left: MatePlacement, right: MatePlacement) {
  return left.feature.get('clipWindow') === right.feature.get('clipWindow')
}

/**
 * Whether a lane places any of the anchor strictly between `lo` and `hi`,
 * from every group's anchor sorted by start with a running reach, so a query
 * is one binary search.
 */
function placedAnchorOf(groups: MultiWayGroup[]) {
  const byKey = new Map<string, MultiWayPlacement[]>()
  for (const group of groups) {
    for (const assemblyName of group.mates.keys()) {
      const key = `${assemblyName}\u0000${group.anchor.refName}`
      let list = byKey.get(key)
      if (!list) {
        list = []
        byKey.set(key, list)
      }
      list.push(group.anchor)
    }
  }
  const index = new Map<string, { starts: number[]; reach: number[] }>()
  for (const [key, anchors] of byKey) {
    anchors.sort((a, b) => a.start - b.start)
    let reach = Number.NEGATIVE_INFINITY
    index.set(key, {
      starts: anchors.map(a => a.start),
      reach: anchors.map(a => (reach = Math.max(reach, a.end))),
    })
  }
  return (assemblyName: string, refName: string, lo: number, hi: number) => {
    const entry = index.get(`${assemblyName}\u0000${refName}`)
    if (!entry) {
      return false
    }
    let below = 0
    let above = entry.starts.length
    while (below < above) {
      const mid = (below + above) >> 1
      if (entry.starts[mid]! < hi) {
        below = mid + 1
      } else {
        above = mid
      }
    }
    return below > 0 && entry.reach[below - 1]! > lo
  }
}

type PlacedPiece = { lane: MatePlacement; anchor: MultiWayPlacement }

/** the stretches of `start`..`end` that `spans` leave uncovered */
function uncoveredSpans(
  spans: readonly { start: number; end: number }[],
  start: number,
  end: number,
) {
  const out: { start: number; end: number }[] = []
  let from = start
  for (const span of mergedSpans(spans)) {
    if (span.start > from && from < end) {
      out.push({ start: from, end: Math.min(span.start, end) })
    }
    from = Math.max(from, span.end)
  }
  return from < end ? [...out, { start: from, end }] : out
}

/** the part of a piece over lane bp `start`..`end`, its anchor cut alike */
function laneClipped(
  { lane, anchor }: PlacedPiece,
  start: number,
  end: number,
) {
  const from = Math.max(start, lane.start)
  const to = Math.min(end, lane.end)
  const perLaneBp =
    (anchor.end - anchor.start) / Math.max(lane.end - lane.start, 1)
  const [head, tail] =
    lane.orientation < 0
      ? [lane.end - to, from - lane.start]
      : [from - lane.start, lane.end - to]
  return {
    lane: { start: from, end: to, orientation: lane.orientation },
    anchor: {
      start: anchor.start + head * perLaneBp,
      end: anchor.end - tail * perLaneBp,
    },
  }
}

interface Stretch {
  start: number
  end: number
}

interface HeldPart {
  lane: Stretch
  anchor: Stretch
}

function laneHeldIn(
  { lane, anchor }: ReturnType<typeof laneClipped>,
  lo: number,
  hi: number,
) {
  const from = Math.max(lo, anchor.start)
  const to = Math.min(hi, anchor.end)
  const lanePerAnchorBp =
    (lane.end - lane.start) / Math.max(anchor.end - anchor.start, 1)
  const [head, tail] =
    lane.orientation < 0
      ? [anchor.end - to, from - anchor.start]
      : [from - anchor.start, anchor.end - to]
  return to > from
    ? [
        {
          lane: {
            start: lane.start + head * lanePerAnchorBp,
            end: lane.end - tail * lanePerAnchorBp,
          },
          anchor: { start: from, end: to },
        },
      ]
    : []
}

function hullBp(stretches: readonly Stretch[]) {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (const stretch of stretches) {
    start = Math.min(start, stretch.start)
    end = Math.max(end, stretch.end)
  }
  return end - start
}

/**
 * Runs chain parts as the turned strand's own reading does (`forEachLaneGap`),
 * so the stretch between two parts of a run is that strand's gap
 */
function partingOf(held: readonly HeldPart[], orientation: number) {
  const runs: HeldPart[][] = []
  for (const part of held.toSorted((a, b) => a.lane.start - b.lane.start)) {
    const run = runs.at(-1)
    const reach = run?.at(-1)
    if (!run || !reach) {
      runs.push([part])
    } else if (part.lane.end > reach.lane.end) {
      const follows =
        orientation < 0
          ? part.anchor.start > reach.anchor.start &&
            part.anchor.end > reach.anchor.end
          : part.anchor.start < reach.anchor.start &&
            part.anchor.end < reach.anchor.end
      if (follows) {
        run.push(part)
      } else {
        runs.push([part])
      }
    }
  }
  return runs
    .filter(
      run =>
        Math.max(
          hullBp(run.map(p => p.lane)),
          hullBp(run.map(p => p.anchor)),
        ) >= SPLIT_AT_GAP_BP,
    )
    .flat()
}

function segmentsOf(
  parting: readonly Stretch[],
  held: readonly Stretch[],
  start: number,
  end: number,
) {
  const covered = mergedSpans(held)
  const segments: (Stretch & { bp: number })[] = []
  let from = start
  let reached = 0
  const cutAt = (to: number) => {
    while (reached < covered.length && covered[reached]!.end <= from) {
      reached++
    }
    let bp = to - from
    for (let i = reached; i < covered.length && covered[i]!.start < to; i++) {
      bp -= Math.min(covered[i]!.end, to) - Math.max(covered[i]!.start, from)
    }
    segments.push({ start: from, end: to, bp: Math.max(0, Math.round(bp)) })
  }
  for (const stretch of parting.toSorted((a, b) => a.start - b.start)) {
    cutAt(Math.max(from, stretch.start))
    from = Math.max(from, stretch.end)
  }
  cutAt(end)
  return segments
}

/**
 * What a lane states across each gap between two consecutive pieces of one
 * contig read on `orientation`, the strand the lane is drawn on, in one fetch
 * window. Pieces of the other strand never bound a gap; lying in one, even
 * in part, they hold what of its anchor stretch their part in it aligns to.
 * The rest of that stretch is the anchor's side and the lane's bp holding
 * none of it the lane's side, one change worded by both. Where they part the
 * gap, each breakpoint is its own change of the two stretches beside one
 * drawn flank, since the anchor beside a turned piece's edge lies at the
 * other breakpoint. That holds within one record, and across two where the
 * lane places the rest nowhere; two records meeting where it went elsewhere
 * in the lane are a rearrangement's breakpoint, whose anchor distance runs to
 * megabases. An opening is the anchor bp between the two pieces less the lane
 * bp between them, so each piece of the drawn strand sits under its own
 * anchor stretch; between two fetch windows lies anchor the fetch never read,
 * which opens and states nothing. A right piece stepping back to anchor the
 * left piece also holds, a tandem copy, states the lane bp repeating it as an
 * insertion at the left piece's anchor end; a step back to before the left
 * piece's anchor is a rearrangement and states nothing. A gap's anchor side
 * starts past the anchor that the drawn pieces before it reached, from its
 * left piece back through each whose anchor the next one starts inside, read
 * on the drawn strand, so a copy leaves the change and the opening after it
 * as the lane without the copy has them. Named records are genes, whose
 * spacing says nothing. An array record, of either strand, bounds gaps as a
 * piece of the drawn strand does, and a gap it bounds opens and states
 * nothing, since its anchor stretch is only where its copies lie.
 */
function laneGapsOf(
  list: readonly PlacedPiece[],
  orientation: number,
  placedElsewhere: (refName: string, lo: number, hi: number) => boolean,
) {
  const arrayPiece = (p: PlacedPiece) => isArrayRecord(p.lane.feature)
  const drawn = list.filter(
    p => arrayPiece(p) || p.lane.orientation === orientation,
  )
  const turned = list.filter(
    p => !arrayPiece(p) && p.lane.orientation !== orientation,
  )
  const openings: LaneOpening[] = []
  const unparted: LaneChange[] = []
  const parted: LaneChange[] = []
  const startsWithin = (
    anchor: LanePiece['anchor'],
    held: LanePiece['anchor'],
  ) =>
    anchor.refName === held.refName &&
    (orientation < 0
      ? anchor.end <= held.end && anchor.end >= held.start
      : anchor.start >= held.start && anchor.start <= held.end)
  let reached = { refName: '', start: 0, end: 0 }
  forEachLaneGap(drawn, (left, right, laneGap, anchorGap) => {
    const { anchor } = left
    reached = arrayPiece(left)
      ? reached
      : startsWithin(anchor, reached)
        ? {
            refName: anchor.refName,
            start: Math.min(reached.start, anchor.start),
            end: Math.max(reached.end, anchor.end),
          }
        : anchor
    const [lo, hi] =
      orientation < 0
        ? [right.anchor.end, Math.max(right.anchor.end, reached.start)]
        : [Math.min(right.anchor.start, reached.end), right.anchor.start]
    const inGap = turned.filter(
      p =>
        p.anchor.refName === left.anchor.refName &&
        p.lane.end > left.lane.end &&
        p.lane.start < right.lane.start,
    )
    if (
      anchorGap !== undefined &&
      !arrayPiece(left) &&
      !arrayPiece(right) &&
      oneWindow(left.lane, right.lane) &&
      (oneRecord(left.lane, right.lane) ||
        !uncoveredSpans(
          inGap.map(p => p.anchor),
          lo,
          hi,
        ).some(rest =>
          placedElsewhere(left.anchor.refName, rest.start, rest.end),
        ))
    ) {
      const at = left.lane.end
      const net = hi - lo - laneGap
      if (laneGap >= 0 && net >= SPLIT_AT_GAP_BP) {
        openings.push({ at, bp: net })
      }
      if (
        anchorGap < 0 &&
        startsWithin(right.anchor, left.anchor) &&
        right.lane.end > left.lane.end
      ) {
        const laneBp = Math.min(
          laneGap - anchorGap,
          right.lane.end - left.lane.end,
        )
        const point = orientation < 0 ? left.anchor.start : left.anchor.end
        if (laneBp >= SPLIT_AT_GAP_BP) {
          unparted.push({
            at: Math.round(at),
            laneEnd: Math.round(at + laneBp),
            laneBp,
            anchorBp: 0,
            kind: 'insertion',
            anchor: { refName: left.anchor.refName, start: point, end: point },
          })
        }
      }
      if (anchorGap >= 0 && right.lane.end > left.lane.end) {
        const held = inGap.flatMap(p =>
          laneHeldIn(laneClipped(p, at, right.lane.start), lo, hi),
        )
        const parting = partingOf(held, orientation)
        const laneSegments = segmentsOf(
          parting.map(p => p.lane),
          held.map(p => p.lane),
          at,
          right.lane.start,
        )
        const anchorSegments = segmentsOf(
          parting.map(p => p.anchor),
          held.map(p => p.anchor),
          lo,
          hi,
        )
        const [leftEdge, rightEdge] = orientation < 0 ? [-1, 0] : [0, -1]
        const sides = [
          { lane: laneSegments[0], anchor: anchorSegments.at(leftEdge) },
          ...(parting.length
            ? [
                {
                  lane: laneSegments.at(-1),
                  anchor: anchorSegments.at(rightEdge),
                },
              ]
            : []),
          ...laneSegments.slice(1, -1).map(lane => ({
            lane,
            anchor: { start: lo, end: hi, bp: 0 },
          })),
          ...anchorSegments.slice(1, -1).map(anchor => ({
            lane: { start: at, end: right.lane.start, bp: 0 },
            anchor,
          })),
        ]
        const changes = parting.length ? parted : unparted
        for (const { lane, anchor } of sides) {
          if (
            lane &&
            anchor &&
            Math.max(lane.bp, anchor.bp) >= SPLIT_AT_GAP_BP
          ) {
            changes.push({
              at: Math.round(lane.start),
              laneEnd: Math.round(lane.end),
              laneBp: lane.bp,
              anchorBp: anchor.bp,
              kind:
                lane.bp === 0
                  ? 'deletion'
                  : anchor.bp === 0
                    ? 'insertion'
                    : 'replacement',
              anchor: {
                refName: left.anchor.refName,
                start: Math.round(anchor.start),
                end: Math.round(anchor.end),
              },
            })
          }
        }
      }
    }
  })
  return { openings, unparted, parted }
}

/**
 * whether two changes share an anchor base or a lane base, on a side both
 * hold bp on: the empty side of a change spans its whole gap
 */
function sameGap(a: LaneChange, b: LaneChange) {
  return (
    (a.anchorBp > 0 &&
      b.anchorBp > 0 &&
      a.anchor.refName === b.anchor.refName &&
      Math.min(a.anchor.end, b.anchor.end) >
        Math.max(a.anchor.start, b.anchor.start)) ||
    (a.laneBp > 0 &&
      b.laneBp > 0 &&
      Math.min(a.laneEnd, b.laneEnd) > Math.max(a.at, b.at))
  )
}

/**
 * Each lane contig's openings and stated changes, read on either strand
 * (`laneGapsOf`). The holes come from the strand the lane is drawn on alone;
 * its changes are that strand's unparted gaps, then each of the other
 * strand's sharing nothing with one of them (`sameGap`), then the parted
 * gaps' changes sharing nothing with one kept, that strand's first, each kept
 * or dropped whole, then the inversions among its runs (`laneInversionsOf`),
 * which read the same whichever way the lane is drawn; and its array records,
 * which state neither and are read on no strand
 */
export function laneIndelsOf(groups: MultiWayGroup[]) {
  const pieces = new Map<string, PlacedPiece[]>()
  for (const group of groups) {
    if (!isNamedRecord(group.feature)) {
      for (const [assemblyName, placements] of group.mates) {
        for (const lane of placements) {
          const key = `${assemblyName}\u0000${lane.refName}`
          let list = pieces.get(key)
          if (!list) {
            list = []
            pieces.set(key, list)
          }
          list.push({ lane, anchor: group.anchor })
        }
      }
    }
  }
  const placedAnchor = placedAnchorOf(groups)
  const openingsByLane = new Map<string, LaneOpening[]>()
  const changesByLane = new Map<string, LaneChange[]>()
  const repeatsByLane = new Map<string, LaneRepeat[]>()
  for (const [key, list] of pieces) {
    const assemblyName = key.slice(0, key.indexOf('\u0000'))
    list.sort((a, b) => a.lane.start - b.lane.start)
    const repeats = list
      .filter(p => isArrayRecord(p.lane.feature))
      .map(({ lane, anchor }) => ({
        at: lane.start,
        laneBp: lane.end - lane.start,
        anchorBp: anchor.end - anchor.start,
        laneWalks: walksOf(lane.feature, 'hapWalks'),
        anchorWalks: walksOf(lane.feature, 'refWalks'),
        anchor: {
          refName: anchor.refName,
          start: anchor.start,
          end: anchor.end,
        },
      }))
    if (repeats.length) {
      repeatsByLane.set(key, repeats)
    }
    const inversions = laneInversionsOf(list)
    const strands = [1, -1].map(orientation => ({
      orientation,
      ...laneGapsOf(list, orientation, (refName, lo, hi) =>
        placedAnchor(assemblyName, refName, lo, hi),
      ),
    }))
    for (const { orientation, openings, unparted, parted } of strands) {
      const other = strands.find(s => s.orientation !== orientation)!
      const whole = [
        ...unparted,
        ...other.unparted.filter(
          gap => !unparted.some(own => sameGap(own, gap)),
        ),
      ]
      const breakpoints = parted.filter(
        change => !whole.some(gap => sameGap(gap, change)),
      )
      const kept = [...whole, ...breakpoints]
      const stated = [
        ...kept,
        ...other.parted.filter(
          change => !kept.some(own => sameGap(own, change)),
        ),
        ...inversions,
      ]
      const strandKey = `${key}\u0000${orientation}`
      if (openings.length) {
        openingsByLane.set(strandKey, openings)
      }
      if (stated.length) {
        changesByLane.set(strandKey, stated)
      }
    }
  }
  const keyOf = (assemblyName: string, refName: string, reversed: boolean) =>
    `${assemblyName}\u0000${refName}\u0000${reversed ? -1 : 1}`
  return {
    openings: (
      assemblyName: string,
      refName: string,
      reversed = false,
    ): readonly LaneOpening[] =>
      openingsByLane.get(keyOf(assemblyName, refName, reversed)) ?? NO_OPENINGS,
    changes: (
      assemblyName: string,
      refName: string,
      reversed = false,
    ): readonly LaneChange[] =>
      changesByLane.get(keyOf(assemblyName, refName, reversed)) ?? NO_CHANGES,
    repeats: (assemblyName: string, refName: string): readonly LaneRepeat[] =>
      repeatsByLane.get(`${assemblyName}\u0000${refName}`) ?? NO_REPEATS,
  }
}

function matesOf(feature: Feature): SyntenyGroupedMate[] {
  const mates = getMates(feature)
  const mate = getMate(feature)
  return mates !== undefined
    ? mates
    : mate === undefined
      ? []
      : [{ ...mate, orientation: feature.get('strand') === -1 ? -1 : 1 }]
}

function nameOf(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

// Name before syntenyId, since an MCScan anchor gene carries a different
// syntenyId on each pair.
function groupKeyOf(feature: Feature) {
  const name = feature.get('name')
  if (name !== undefined) {
    return name
  }
  const syntenyId = feature.get('syntenyId')
  return syntenyId === undefined ? feature.id() : String(syntenyId)
}

export function groupFeatures(features: readonly Feature[]) {
  const byKey = new Map<string, MultiWayGroup>()
  const seen = new Map<string, number[]>()
  for (const feature of features) {
    const key = groupKeyOf(feature)
    let group = byKey.get(key)
    if (!group) {
      const start = feature.get('start')
      const end = feature.get('end')
      group = {
        key,
        anchor: {
          refName: feature.get('refName'),
          start,
          end,
          name: nameOf(feature.get('name')),
        },
        mates: new Map(),
        feature,
        weight: voteEvidence(isNamedRecord(feature), Math.max(end - start, 1)),
      }
      byKey.set(key, group)
    }
    for (const mate of matesOf(feature)) {
      const seenKey = `${key}|${mate.assemblyName}|${mate.refName}|${mate.start}|${mate.end}`
      const stated = seen.get(seenKey)
      if (stated) {
        if (mate.row !== undefined && !stated.includes(mate.row)) {
          stated.push(mate.row)
        }
      } else {
        const rows = mate.row === undefined ? [] : [mate.row]
        seen.set(seenKey, rows)
        let placements = group.mates.get(mate.assemblyName)
        if (!placements) {
          placements = []
          group.mates.set(mate.assemblyName, placements)
        }
        placements.push({
          refName: mate.refName,
          start: mate.start,
          end: mate.end,
          name: nameOf(mate.name),
          rows: mate.row === undefined ? undefined : rows,
          orientation: mate.orientation < 0 ? -1 : 1,
          feature,
        })
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.anchor.refName.localeCompare(b.anchor.refName) ||
      a.anchor.start - b.anchor.start,
  )
}

/**
 * Rows fetched on each lane's own window that place nothing on the anchor.
 * Rows sharing a placement are one group, however many lanes read them: a
 * table folds a lane's rows by that lane's gene, so a paralog pair reads as
 * two rows from one lane and one from the other. A group is keyed by its
 * lowest placement, and each placement's orientation is its gene's own
 * strand, since the rows of one group were read against different lanes.
 */
export function anchorlessGroupsOf(
  byLane: Iterable<readonly [string, readonly Feature[]]>,
  onAnchor: (assemblyName: string) => boolean,
) {
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    const up = parent.get(id) ?? id
    if (up === id) {
      return id
    }
    const root = find(up)
    parent.set(id, root)
    return root
  }
  const placements = new Map<
    string,
    { assemblyName: string; placement: MatePlacement }
  >()
  for (const [lane, features] of byLane) {
    for (const feature of features) {
      const mates = matesOf(feature)
      if (!mates.some(mate => onAnchor(mate.assemblyName))) {
        const ids = [
          {
            assemblyName: lane,
            refName: feature.get('refName'),
            start: feature.get('start'),
            end: feature.get('end'),
            name: feature.get('name'),
            strand: feature.get('strand'),
          },
          ...mates,
        ].map(p => {
          const id = `${p.assemblyName}:${p.refName}:${p.start}-${p.end}`
          if (!placements.has(id)) {
            placements.set(id, {
              assemblyName: p.assemblyName,
              placement: {
                refName: p.refName,
                start: p.start,
                end: p.end,
                name: nameOf(p.name),
                orientation: p.strand === -1 ? -1 : 1,
                feature,
              },
            })
          }
          return id
        })
        for (const id of ids.slice(1)) {
          const a = find(ids[0]!)
          const b = find(id)
          if (a !== b) {
            parent.set(a < b ? b : a, a < b ? a : b)
          }
        }
      }
    }
  }
  const byKey = new Map<string, PlacedGroup>()
  for (const [id, { assemblyName, placement }] of placements) {
    const key = find(id)
    let group = byKey.get(key)
    if (!group) {
      group = { key, mates: new Map(), feature: placement.feature }
      byKey.set(key, group)
    }
    const on = group.mates.get(assemblyName) ?? []
    on.push(placement)
    group.mates.set(assemblyName, on)
  }
  return [...byKey.values()]
}

/**
 * The slice of a placement's mate that the anchor interval [`start`, `end`]
 * takes: along its record's alignment ops where it carries them, as the
 * ribbon draws it, and in proportion to `anchor` where not
 */
export function placementMateInterval(
  anchor: MultiWayPlacement,
  placement: MatePlacement,
  ops: AlignmentOpsById,
  start: number,
  end: number,
) {
  const { feature, orientation } = placement
  const recordOps = ops.get(feature.id())
  const mate = getMate(feature)
  return (
    recordOps && mate
      ? cutAlignment(
          { start: feature.get('start'), end: feature.get('end') },
          mate,
          orientation,
          recordOps,
          start,
          end,
        )
      : cutAlignment(anchor, placement, orientation, undefined, start, end)
  ).mate
}

export function clipGroupToAnchor(
  group: MultiWayGroup,
  start: number,
  end: number,
  ops: AlignmentOpsById = NO_OPS,
): MultiWayGroup {
  const { anchor } = group
  const from = Math.max(anchor.start, start)
  const to = Math.min(anchor.end, end)
  return from === anchor.start && to === anchor.end
    ? group
    : {
        ...group,
        anchor: { ...anchor, start: from, end: to },
        weight: voteEvidence(
          isNamedRecord(group.feature),
          Math.max(to - from, 1),
        ),
        mates: new Map(
          [...group.mates].map(([assemblyName, placements]) => [
            assemblyName,
            placements.map(p => {
              const mate = placementMateInterval(anchor, p, ops, from, to)
              return {
                ...p,
                start: Math.round(mate.start),
                end: Math.round(mate.end),
              }
            }),
          ]),
        ),
      }
}

export function groupSpansLanes(group: PlacedGroup) {
  return group.mates.size > 1 || isNamedRecord(group.feature)
}

/**
 * The `lanes` that `sort` names, in the order its entries are written. An
 * entry naming a lane takes it; one naming a genome takes each of that
 * genome's copy lanes no entry of `named` names; one naming a copy takes its
 * genome's lane where the lanes are genomes, so a sort written for one
 * `rows.field` orders the other.
 */
export function sortedLanes(
  lanes: readonly string[],
  sort: readonly string[],
  keyOf: (lane: string) => string,
  named: readonly string[] = sort,
) {
  const namedKeys = new Set(named.map(keyOf))
  const byKey = new Map<string, string[]>()
  const copiesOf = new Map<string, string[]>()
  const add = (map: Map<string, string[]>, key: string, lane: string) => {
    map.set(key, [...(map.get(key) ?? []), lane])
  }
  for (const lane of lanes) {
    const key = keyOf(lane)
    add(byKey, key, lane)
    if (isCopyLane(lane) && !namedKeys.has(key)) {
      add(copiesOf, keyOf(laneGenome(lane)), lane)
    }
  }
  const out = new Set<string>()
  for (const entry of sort) {
    const key = keyOf(entry)
    const taken = isCopyLane(entry)
      ? (byKey.get(key) ??
        (byKey.get(keyOf(laneGenome(entry))) ?? []).filter(
          lane => !isCopyLane(lane),
        ))
      : [...(byKey.get(key) ?? []), ...(copiesOf.get(key) ?? [])]
    for (const lane of taken) {
      out.add(lane)
    }
  }
  return [...out]
}

/**
 * Lanes densest first, a genome's copy lanes together under its densest,
 * `preferred` ones leading in its order (`sortedLanes`);
 * `placeless` lanes, which the window shows none of, sit at the foot whatever
 * `preferred` says, since a frameless lane between two others leaves both
 * gutters empty
 */
export function rowAssembliesOf(
  groups: MultiWayGroup[],
  preferred: readonly string[],
  keyOf: (assemblyName: string) => string = name => name,
  placeless: readonly string[] = [],
) {
  const evidence = new Map<string, Map<string, number>>()
  for (const group of groups) {
    for (const [assemblyName, placements] of group.mates) {
      let byContig = evidence.get(assemblyName)
      if (!byContig) {
        byContig = new Map()
        evidence.set(assemblyName, byContig)
      }
      for (const p of placements) {
        byContig.set(p.refName, (byContig.get(p.refName) ?? 0) + group.weight)
      }
    }
  }
  const lanes = [...evidence].map(([assemblyName, byContig], appearance) => ({
    assemblyName,
    genome: keyOf(laneGenome(assemblyName)),
    appearance,
    density: [...byContig.values()].reduce((most, w) => Math.max(most, w), 0),
  }))
  const genomes = new Map<string, { appearance: number; density: number }>()
  for (const { genome, appearance, density } of lanes) {
    const seen = genomes.get(genome)
    genomes.set(genome, {
      appearance: seen?.appearance ?? appearance,
      density: Math.max(seen?.density ?? 0, density),
    })
  }
  const present = lanes
    .sort((a, b) => {
      const ga = genomes.get(a.genome)!
      const gb = genomes.get(b.genome)!
      return (
        gb.density - ga.density ||
        ga.appearance - gb.appearance ||
        b.density - a.density ||
        a.appearance - b.appearance
      )
    })
    .map(lane => lane.assemblyName)
  const pinned = new Set(sortedLanes(present, preferred, keyOf))
  const presentKeys = new Set(
    present.flatMap(name => [keyOf(name), keyOf(laneGenome(name))]),
  )
  const foot = new Map<string, string>()
  for (const name of placeless) {
    const key = keyOf(name)
    if (!presentKeys.has(key) && !foot.has(key)) {
      foot.set(key, name)
    }
  }
  return [
    ...pinned,
    ...present.filter(name => !pinned.has(name)),
    ...foot.values(),
  ]
}

export function tickIntervalFor(spanBp: number) {
  const target = Math.max(spanBp, 1) / 6
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = [1, 2, 5].find(candidate => candidate * magnitude >= target)
  return (step === undefined ? 10 : step) * magnitude
}

const MAX_LANE_TICKS = 24

function framesOf(frame: RowFrame) {
  return [frame, ...(frame.morphFrom ?? []).map(from => from.frame)]
}

/** bp, over the frame and every frame a transition moves it from */
function frameExtent(frame: RowFrame) {
  let { min, max } = frame
  for (const from of frame.morphFrom ?? []) {
    min = Math.min(min, from.frame.min)
    max = Math.max(max, from.frame.max)
  }
  return { min, max }
}

/** a screen either side of the frame, as `stackReach` reaches */
export function frameReach(frame: RowFrame) {
  const { min, max } = frameExtent(frame)
  const margin = max - min
  return { min: min - margin, max: max + margin }
}

/** `frameReach` in the lane's own px, ascending */
export function frameReachPx(frame: RowFrame, width: number): Span {
  const { min, max } = frameReach(frame)
  const a = openedX(frame, min, width)
  const b = openedX(frame, max, width)
  return a <= b ? [a, b] : [b, a]
}

export function frameTickXs(frame: RowFrame, interval: number, width: number) {
  const xs: number[] = []
  const span = Math.min(...framesOf(frame).map(f => f.max - f.min))
  if (interval > 0 && span / interval <= MAX_LANE_TICKS) {
    const reach = frameReach(frame)
    const openings = frameOpenings(frame)
    const last = laneBpOfOpened(openings, reach.max)
    for (
      let bp = Math.max(
        0,
        Math.ceil(laneBpOfOpened(openings, reach.min) / interval) * interval,
      );
      bp <= last;
      bp += interval
    ) {
      xs.push(rowFrameX(frame, bp, width))
    }
  }
  return xs
}

export function frameBpPerPx(frame: RowFrame, width: number) {
  return (frame.max - frame.min) / width
}

function openedX(frame: RowFrame, opened: number, width: number) {
  const t = (opened - frame.min) / (frame.max - frame.min)
  return frame.flipped ? width * (1 - t) : width * t
}

/** the inverse of `openedX` */
export function openedAtX(frame: RowFrame, px: number, width: number) {
  const bpPerPx = frameBpPerPx(frame, width)
  return frame.flipped
    ? frame.min + (width - px) * bpPerPx
    : frame.min + px * bpPerPx
}

export function rowFrameX(frame: RowFrame, bp: number, width: number) {
  return openedX(frame, openedBp(frameOpenings(frame), bp), width)
}

/** the inverse of `rowFrameX` */
export function laneBpAt(frame: RowFrame, px: number, width: number) {
  return laneBpOfOpened(frameOpenings(frame), openedAtX(frame, px, width))
}

/** A px pair in the interval's own order, clipped to `frameReach`. */
export function frameSpan(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
): Span | undefined {
  const { min, max } = frameReach(frame)
  const openings = frameOpenings(frame)
  const lo = openedBp(openings, Math.min(start, end), true)
  const hi = Math.max(lo, openedBp(openings, Math.max(start, end)))
  if (!doesIntersect2(min, max, lo, hi)) {
    return undefined
  }
  const a = openedX(frame, clamp(lo, min, max), width)
  const b = openedX(frame, clamp(hi, min, max), width)
  return start <= end ? [a, b] : [b, a]
}

function cutAtOpenings(
  openings: readonly LaneOpening[],
  start: number,
  end: number,
) {
  const cuts = openings.filter(o => o.at > start && o.at < end).map(o => o.at)
  const bounds = [start, ...cuts, end]
  return bounds.slice(1).map((to, i) => [bounds[i]!, to] as const)
}

/** `frameSpan` of each piece of an ascending interval, cut at every hole */
export function frameSpans(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
): Span[] {
  return cutAtOpenings(frameOpenings(frame), start, end).flatMap(
    ([from, to]) => {
      const span = frameSpan(frame, from, to, width)
      return span ? [span] : []
    },
  )
}

/** each hole-free piece of a stretch of the lane, with its px span */
export function frameSegments(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
) {
  const openings = frameOpenings(frame)
  return cutAtOpenings(openings, start, end).map(([from, to]) => ({
    start: from,
    end: to,
    px: [
      openedX(frame, openedBp(openings, from, true), width),
      openedX(frame, openedBp(openings, to), width),
    ] as Span,
  }))
}

interface PlacementRun {
  min: number
  max: number
  orientation: number
  name?: string
  rows?: readonly number[]
  feature: Feature
}

export function groupRunsOnRow(
  group: PlacedGroup,
  assemblyName: string,
  frame: RowFrame,
): PlacementRun[] {
  const { min, max } = frameExtent(frame)
  const openings = frameOpenings(frame)
  const placements = (group.mates.get(assemblyName) ?? [])
    .filter(
      p =>
        p.refName === frame.refName &&
        doesIntersect2(
          min,
          max,
          openedBp(openings, p.start, true),
          openedBp(openings, p.end),
        ),
    )
    .sort((a, b) => a.start - b.start)
  const runs: {
    min: number
    max: number
    signed: number
    names: Set<string | undefined>
    rows: Set<number> | undefined
    widest: MatePlacement
  }[] = []
  for (const p of placements) {
    const length = Math.max(p.end - p.start, 1)
    const last = runs.at(-1)
    if (last && p.start <= last.max) {
      last.max = Math.max(last.max, p.end)
      last.signed += p.orientation * length
      last.names.add(p.name)
      for (const row of p.rows ?? []) {
        last.rows?.add(row)
      }
      if (length > last.widest.end - last.widest.start) {
        last.widest = p
      }
    } else {
      runs.push({
        min: p.start,
        max: p.end,
        signed: p.orientation * length,
        names: new Set([p.name]),
        rows: p.rows && new Set(p.rows),
        widest: p,
      })
    }
  }
  return runs.map(({ min, max, signed, names, rows, widest }) => ({
    min,
    max,
    orientation: signed < 0 ? -1 : 1,
    name: names.size === 1 ? [...names][0] : undefined,
    rows: rows && [...rows],
    feature: widest.feature,
  }))
}

/**
 * Ordered px pairs, the end matching the anchor's start first, so a reversed
 * pair draws the inversion's twist. A caller drawing a box sorts them.
 */
export function groupRunSpansOnRow(
  group: PlacedGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
): {
  span: Span
  orientation: number
  interval: MultiWayPlacement
  feature: Feature
}[] {
  // every run holds a placement the frame shows, so `frameSpan` answers
  return groupRunsOnRow(group, assemblyName, frame).map(run => {
    const [a, b] = frameSpan(frame, run.min, run.max, width)!
    return {
      span: run.orientation < 0 ? ([b, a] as const) : ([a, b] as const),
      orientation: run.orientation,
      interval: {
        refName: frame.refName,
        start: run.min,
        end: run.max,
        name: run.name,
        rows: run.rows,
      },
      feature: run.feature,
    }
  })
}

export function laneFetchWindow(frame: RowFrame) {
  const span = frame.max - frame.min
  const openings = frameOpenings(frame)
  return {
    min: Math.min(laneBpOfOpened(openings, frame.min), frame.fitMax - span),
    max: Math.max(laneBpOfOpened(openings, frame.max), frame.fitMin + span),
  }
}

function snappedFetchRegion(frame: RowFrame, grid: number) {
  const { min, max } = laneFetchWindow(frame)
  const span = frame.max - frame.min
  return {
    refName: frame.refName,
    start: Math.max(0, Math.floor((min - span / 2) / grid) * grid),
    end: Math.ceil((max + span / 2) / grid) * grid,
  }
}

// The grid comes off the rung span alone, so a fitted-extent change cannot
// double it and refetch every lane.
export function laneFetchRegion(frame: RowFrame) {
  return snappedFetchRegion(frame, laneFetchGrid(frame.max - frame.min))
}

/**
 * The region a lane reads a template layer over: the lane fetch's own, or
 * where that could pass `maxBp`, one on a finer grid down to a quarter of the
 * span, which refetches more often along a pan but keeps a 1-2 Mb lane's
 * layers; undefined past that. The bound reads the span, since the snapped
 * region doubles across a grid line and the layer would blink along a pan.
 */
export function laneTemplateRegion(frame: RowFrame, maxBp: number) {
  const span = frame.max - frame.min
  for (let grid = laneFetchGrid(span); grid >= span / 4; grid /= 2) {
    if (grid * (Math.floor((2 * span) / grid) + 2) <= maxBp) {
      return snappedFetchRegion(frame, grid)
    }
  }
  return undefined
}

function laneFetchGrid(spanBp: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(2 * spanBp, 1)))
}

export function laneFetchRegionMaxBp(spanBp: number) {
  return 2 * laneFetchGrid(spanBp)
}
