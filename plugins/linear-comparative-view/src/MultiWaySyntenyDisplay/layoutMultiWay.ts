import { clamp, doesIntersect2 } from '@jbrowse/core/util'

import { mateSlice } from '../mateBpAt.ts'
import { voteEvidence } from '../syntenyHysteresis.ts'
import { getMate, getMates, isNamedRecord } from '../syntenyMate.ts'

import type { SyntenyGroupedMate } from '../syntenyMate.ts'
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

const NO_OPENINGS: readonly LaneOpening[] = []

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

/** The lane bp at an opened coordinate; inside a hole, the hole's own `at`. */
export function laneBpOfOpened(openings: readonly LaneOpening[], at: number) {
  let shift = 0
  for (const opening of openings) {
    if (at <= opening.at + shift) {
      break
    }
    if (at < opening.at + shift + opening.bp) {
      return opening.at
    }
    shift += opening.bp
  }
  return at - shift
}

export function frameOpenings(frame: RowFrame) {
  return frame.openings ?? NO_OPENINGS
}

/**
 * Where two alignment pieces of a lane abut, or nearly, while their anchor
 * ends sit at least `SPLIT_AT_GAP_BP` further apart. Named records are genes,
 * whose spacing says nothing about a deletion.
 */
export function laneOpeningsOf(groups: MultiWayGroup[]) {
  const pieces = new Map<
    string,
    { lane: MatePlacement; anchor: MultiWayPlacement }[]
  >()
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
  const byLane = new Map<string, LaneOpening[]>()
  for (const [key, list] of pieces) {
    list.sort((a, b) => a.lane.start - b.lane.start)
    const openings: LaneOpening[] = []
    for (let i = 1; i < list.length; i++) {
      const left = list[i - 1]!
      const right = list[i]!
      const laneGap = right.lane.start - left.lane.end
      const anchorGap =
        left.lane.orientation < 0
          ? left.anchor.start - right.anchor.end
          : right.anchor.start - left.anchor.end
      if (
        left.lane.orientation === right.lane.orientation &&
        left.anchor.refName === right.anchor.refName &&
        laneGap >= 0 &&
        anchorGap - laneGap >= SPLIT_AT_GAP_BP
      ) {
        openings.push({ at: left.lane.end, bp: anchorGap - laneGap })
      }
    }
    if (openings.length) {
      byLane.set(key, openings)
    }
  }
  return (assemblyName: string, refName: string): readonly LaneOpening[] =>
    byLane.get(`${assemblyName}\u0000${refName}`) ?? NO_OPENINGS
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

export function groupFeatures(features: Feature[]) {
  const byKey = new Map<string, MultiWayGroup>()
  const seen = new Set<string>()
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
      if (!seen.has(seenKey)) {
        seen.add(seenKey)
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
 * Rows fetched on each lane's own window that place nothing on the anchor. A
 * row read from two lanes is one group, keyed by every placement it holds;
 * its orientations are against the lane that read it first.
 */
export function anchorlessGroupsOf(
  byLane: Iterable<readonly [string, readonly Feature[]]>,
  onAnchor: (assemblyName: string) => boolean,
) {
  const byKey = new Map<string, PlacedGroup>()
  for (const [lane, features] of byLane) {
    for (const feature of features) {
      const mates = matesOf(feature)
      if (!mates.some(mate => onAnchor(mate.assemblyName))) {
        const placements = [
          {
            assemblyName: lane,
            refName: feature.get('refName'),
            start: feature.get('start'),
            end: feature.get('end'),
            name: feature.get('name'),
            orientation: 1,
          },
          ...mates,
        ]
        const key = placements
          .map(p => `${p.assemblyName}:${p.refName}:${p.start}-${p.end}`)
          .sort()
          .join(',')
        if (!byKey.has(key)) {
          const byAssembly = new Map<string, MatePlacement[]>()
          for (const p of placements) {
            const on = byAssembly.get(p.assemblyName) ?? []
            on.push({
              refName: p.refName,
              start: p.start,
              end: p.end,
              name: nameOf(p.name),
              orientation: p.orientation < 0 ? -1 : 1,
              feature,
            })
            byAssembly.set(p.assemblyName, on)
          }
          byKey.set(key, { key, mates: byAssembly, feature })
        }
      }
    }
  }
  return [...byKey.values()]
}

/**
 * Cuts each mate by the fractions of its length the anchor's cut takes, from
 * the corresponding end.
 */
export function clipGroupToAnchor(
  group: MultiWayGroup,
  start: number,
  end: number,
): MultiWayGroup {
  const { anchor } = group
  const from = Math.max(anchor.start, start)
  const to = Math.min(anchor.end, end)
  return from === anchor.start && to === anchor.end
    ? group
    : {
        ...group,
        anchor: { ...anchor, start: from, end: to },
        mates: new Map(
          [...group.mates].map(([assemblyName, placements]) => [
            assemblyName,
            placements.map(p => ({
              ...p,
              ...mateSlice(anchor, p, p.orientation, from, to),
            })),
          ]),
        ),
      }
}

export function groupSpansLanes(group: PlacedGroup) {
  return group.mates.size > 1 || isNamedRecord(group.feature)
}

// Densest lane first, after the lanes `preferred` names, in its order.
export function rowAssembliesOf(
  groups: MultiWayGroup[],
  preferred: string[],
  keyOf: (assemblyName: string) => string = name => name,
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
  const present = [...evidence]
    .map(([assemblyName, byContig], appearance) => ({
      assemblyName,
      appearance,
      density: Math.max(0, ...byContig.values()),
    }))
    .sort((a, b) => b.density - a.density || a.appearance - b.appearance)
    .map(lane => lane.assemblyName)
  const byKey = new Map<string, string[]>()
  for (const assemblyName of present) {
    const key = keyOf(assemblyName)
    byKey.set(key, [...(byKey.get(key) ?? []), assemblyName])
  }
  const pinned = new Set<string>()
  for (const name of preferred) {
    for (const assemblyName of byKey.get(keyOf(name)) ?? []) {
      pinned.add(assemblyName)
    }
  }
  return [...pinned, ...present.filter(name => !pinned.has(name))]
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
export function frameExtent(frame: RowFrame) {
  let { min, max } = frame
  for (const from of frame.morphFrom ?? []) {
    min = Math.min(min, from.frame.min)
    max = Math.max(max, from.frame.max)
  }
  return { min, max }
}

export function frameReach(frame: RowFrame) {
  const { min, max } = frameExtent(frame)
  const margin = (max - min) / 2
  return { min: min - margin, max: max + margin }
}

/** `frameReach` in the lane's own px, ascending */
export function frameReachPx(frame: RowFrame, width: number): Span {
  const { min, max } = frameReach(frame)
  const a = openedX(frame, min, width)
  const b = openedX(frame, max, width)
  return a <= b ? [a, b] : [b, a]
}

export function frameMagnification(frame: RowFrame) {
  const span = frame.max - frame.min
  return Math.max(1, ...framesOf(frame).map(f => span / (f.max - f.min)))
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

function openedX(frame: RowFrame, opened: number, width: number) {
  const t = (opened - frame.min) / (frame.max - frame.min)
  return frame.flipped ? width * (1 - t) : width * t
}

export function rowFrameX(frame: RowFrame, bp: number, width: number) {
  return openedX(frame, openedBp(frameOpenings(frame), bp), width)
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

/** px spans of a stretch of the lane, cut at each hole the frame opens in it */
export function frameSegmentsX(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
): Span[] {
  const openings = frameOpenings(frame)
  return cutAtOpenings(openings, start, end).map(([from, to]) => [
    openedX(frame, openedBp(openings, from, true), width),
    openedX(frame, openedBp(openings, to), width),
  ])
}

interface PlacementRun {
  min: number
  max: number
  orientation: number
  name?: string
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
    widest: MatePlacement
  }[] = []
  for (const p of placements) {
    const length = Math.max(p.end - p.start, 1)
    const last = runs.at(-1)
    if (last && p.start <= last.max) {
      last.max = Math.max(last.max, p.end)
      last.signed += p.orientation * length
      last.names.add(p.name)
      if (length > last.widest.end - last.widest.start) {
        last.widest = p
      }
    } else {
      runs.push({
        min: p.start,
        max: p.end,
        signed: p.orientation * length,
        names: new Set([p.name]),
        widest: p,
      })
    }
  }
  return runs.map(({ min, max, signed, names, widest }) => ({
    min,
    max,
    orientation: signed < 0 ? -1 : 1,
    name: names.size === 1 ? [...names][0] : undefined,
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

// The grid comes off the rung span alone, so a fitted-extent change cannot
// double it and refetch every lane.
export function laneFetchRegion(frame: RowFrame) {
  const { min, max } = laneFetchWindow(frame)
  const span = frame.max - frame.min
  const grid = laneFetchGrid(span)
  return {
    refName: frame.refName,
    start: Math.max(0, Math.floor((min - span / 2) / grid) * grid),
    end: Math.ceil((max + span / 2) / grid) * grid,
  }
}

function laneFetchGrid(spanBp: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(2 * spanBp, 1)))
}

export function laneFetchRegionMaxBp(spanBp: number) {
  return 2 * laneFetchGrid(spanBp)
}
