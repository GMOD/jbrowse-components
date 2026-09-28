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

export interface MultiWayGroup {
  key: string
  anchor: MultiWayPlacement
  mates: Map<string, MatePlacement[]>
  feature: Feature
  /** contig-vote evidence: anchor bp for an alignment, 1 for a named gene */
  weight: number
}

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
  morphFrom?: readonly { frame: RowFrame; weight: number }[]
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

export function groupSpansLanes(group: MultiWayGroup) {
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
  const a = rowFrameX(frame, min, width)
  const b = rowFrameX(frame, max, width)
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
    for (
      let bp = Math.max(0, Math.ceil(reach.min / interval) * interval);
      bp <= reach.max;
      bp += interval
    ) {
      xs.push(rowFrameX(frame, bp, width))
    }
  }
  return xs
}

export function rowFrameX(frame: RowFrame, bp: number, width: number) {
  const t = (bp - frame.min) / (frame.max - frame.min)
  return frame.flipped ? width * (1 - t) : width * t
}

/** A px pair in the interval's own order, clipped to `frameReach`. */
export function frameSpan(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
): Span | undefined {
  const { min, max } = frameReach(frame)
  return doesIntersect2(min, max, Math.min(start, end), Math.max(start, end))
    ? [
        rowFrameX(frame, clamp(start, min, max), width),
        rowFrameX(frame, clamp(end, min, max), width),
      ]
    : undefined
}

interface PlacementRun {
  min: number
  max: number
  orientation: number
  name?: string
  feature: Feature
}

export function groupRunsOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
): PlacementRun[] {
  const { min, max } = frameExtent(frame)
  const placements = (group.mates.get(assemblyName) ?? [])
    .filter(
      p =>
        p.refName === frame.refName && doesIntersect2(min, max, p.start, p.end),
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
  group: MultiWayGroup,
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
  return {
    min: Math.min(frame.min, frame.fitMax - span),
    max: Math.max(frame.max, frame.fitMin + span),
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
