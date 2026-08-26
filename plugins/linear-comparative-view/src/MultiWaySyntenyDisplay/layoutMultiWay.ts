import { clamp, doesIntersect2 } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

export type Span = readonly [number, number]

export interface MultiWayPlacement {
  refName: string
  start: number
  end: number
}

/**
 * A mate placement plus how it runs against the anchor. `orientation` is the
 * pairwise FEATURE's own strand — the alignment strand for PAF, the product of
 * the two BED strands for an MCScan row — and never the `strand` inside the
 * `mate` object, which PAF does not set and the MCScan blocks adapter fills
 * with the mate gene's transcription strand. -1 means the two ends of the pair
 * correspond crosswise, which is what makes an inversion's ribbon twist.
 */
export interface MatePlacement extends MultiWayPlacement {
  orientation: number
}

export interface MultiWayGroup {
  key: string
  anchor: MultiWayPlacement
  mates: Map<string, MatePlacement[]>
  feature: Feature
}

export interface RowFrame {
  refName: string
  min: number
  max: number
  flipped: boolean
  // the extent the frame was fitted to, before the ladder rounded its span up.
  // The frame may slide anywhere that still covers this, and that difference is
  // the freedom `decideLaneFrames` works in
  fitMin: number
  fitMax: number
}

interface FeatureMate extends MultiWayPlacement {
  assemblyName: string
}

function mateOf(feature: Feature) {
  return feature.get('mate') as FeatureMate
}

// Name before syntenyId: an MCScan blocks adapter keeps the FIRST row naming a
// gene pair, so one anchor gene surfaces under different row numbers on
// different pairs while its name is one string everywhere.
function groupKeyOf(feature: Feature) {
  const name = feature.get('name')
  if (name !== undefined) {
    return name
  }
  const syntenyId = feature.get('syntenyId')
  return syntenyId === undefined ? feature.id() : String(syntenyId)
}

// One group per anchor gene: the anchor placement plus every mate placement the
// pairwise features name for it. A reference-anchored table repeats a mate
// through each row that reaches it, so placements dedupe on coordinates.
export function groupFeatures(features: Feature[]) {
  const byKey = new Map<string, MultiWayGroup>()
  const seen = new Set<string>()
  for (const feature of features) {
    const key = groupKeyOf(feature)
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        anchor: {
          refName: feature.get('refName'),
          start: feature.get('start'),
          end: feature.get('end'),
        },
        mates: new Map(),
        feature,
      }
      byKey.set(key, group)
    }
    const mate = mateOf(feature)
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
        orientation: feature.get('strand') === -1 ? -1 : 1,
      })
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.anchor.refName.localeCompare(b.anchor.refName) ||
      a.anchor.start - b.anchor.start,
  )
}

// Mate assemblies densest-first over the anchor-sorted groups: a ribbon
// connects ADJACENT lanes only, so a near-empty lane sitting mid-stack cuts the
// chains of every denser lane below it. Density is counted over the whole
// fetched block set rather than the viewport, so the order holds still across
// the pans that keep one fetch. `preferred` (the display's rowOrder) pins the
// lanes it names to the top, in its order — through `isSameName`, because a
// session spec spells an assembly the way the session does while a placement
// spells it the way the table's BED did.
export function rowAssembliesOf(
  groups: MultiWayGroup[],
  preferred: string[],
  isSameName: (a: string, b: string) => boolean,
) {
  const appearance = new Map<string, number>()
  const placementCount = new Map<string, number>()
  for (const group of groups) {
    for (const [assemblyName, placements] of group.mates) {
      if (!appearance.has(assemblyName)) {
        appearance.set(assemblyName, appearance.size)
      }
      placementCount.set(
        assemblyName,
        (placementCount.get(assemblyName) ?? 0) + placements.length,
      )
    }
  }
  const present = [...appearance.keys()].sort(
    (a, b) =>
      placementCount.get(b)! - placementCount.get(a)! ||
      appearance.get(a)! - appearance.get(b)!,
  )
  const pinned: string[] = []
  for (const name of preferred) {
    for (const assemblyName of present) {
      if (isSameName(assemblyName, name) && !pinned.includes(assemblyName)) {
        pinned.push(assemblyName)
      }
    }
  }
  return [...pinned, ...present.filter(name => !pinned.includes(name))]
}

// The one tick interval the whole track draws at, picked off the anchor's
// visible span so it lands about six ticks across it. Every lane draws ITS
// ticks at this same bp interval in its own frame, which is what makes the
// spacing readable as scale: two lanes whose ticks line up are at the same
// bp/px, and a lane whose ticks crowd together is zoomed out by exactly the
// ratio the spacing shows.
export function tickIntervalFor(spanBp: number) {
  const target = Math.max(spanBp, 1) / 6
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const step = [1, 2, 5].find(candidate => candidate * magnitude >= target)
  return (step === undefined ? 10 : step) * magnitude
}

// past this a lane is far enough out that its ticks read as hatching rather
// than as a scale, and the header's multiple is the legible statement
const MAX_LANE_TICKS = 24

// The x positions of the shared tick interval inside one lane's own frame, and
// over half a screen either side of it, since the stack is translated rather
// than relaid between settles.
export function frameTickXs(frame: RowFrame, interval: number, width: number) {
  const xs: number[] = []
  const span = frame.max - frame.min
  if (interval > 0 && span / interval <= MAX_LANE_TICKS) {
    const margin = span / 2
    for (
      let bp = Math.max(
        0,
        Math.ceil((frame.min - margin) / interval) * interval,
      );
      bp <= frame.max + margin;
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

/**
 * One bp interval in a lane's own frame, as a px pair in the interval's own
 * order, or undefined when the frame shows nothing of it.
 *
 * CLIPPED TO THE FRAME, not merely tested against it. `rowFrameX` extrapolates,
 * so an end the frame does not reach maps to tens of thousands of pixels: the
 * rect drawn from it is clipped by the svg and looks fine, while the ribbon
 * keeps that endpoint and sweeps across everything. A record STRADDLING the
 * frame edge passes any intersection test, and the lane fetches a window wider
 * than its frame by construction, so straddlers arrive on every fetch.
 *
 * Clipping in bp keeps the pair in the interval's own order and keeps a flipped
 * lane's mirroring intact, since `rowFrameX` is monotonic either way.
 */
export function frameSpan(
  frame: RowFrame,
  start: number,
  end: number,
  width: number,
): Span | undefined {
  return doesIntersect2(frame.min, frame.max, start, end)
    ? [
        rowFrameX(frame, clamp(start, frame.min, frame.max), width),
        rowFrameX(frame, clamp(end, frame.min, frame.max), width),
      ]
    : undefined
}

interface PlacementRun {
  min: number
  max: number
  orientation: number
}

// The group's placements on one row as maximal OVERLAPPING RUNS: two hits the
// row shows apart from each other stay two spans, and only placements that
// actually touch merge into one, so the gap between two disjoint hits is not
// drawn as syntenic sequence.
//
// Filtered to the frame, which is what keeps `computeRowFrame`'s outlier rule
// from being undone here — see `frameSpan`.
export function groupRunsOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
): PlacementRun[] {
  const placements = (group.mates.get(assemblyName) ?? [])
    .filter(
      p =>
        p.refName === frame.refName &&
        doesIntersect2(frame.min, frame.max, p.start, p.end),
    )
    .sort((a, b) => a.start - b.start)
  // length-weighted within a run, so a fragment aligning the other way cannot
  // outvote the block it sits inside
  const runs: { min: number; max: number; signed: number }[] = []
  for (const p of placements) {
    const weight = p.orientation * Math.max(p.end - p.start, 1)
    const last = runs.at(-1)
    if (last && p.start <= last.max) {
      last.max = Math.max(last.max, p.end)
      last.signed += weight
    } else {
      runs.push({ min: p.start, max: p.end, signed: weight })
    }
  }
  return runs.map(({ min, max, signed }) => ({
    min,
    max,
    orientation: signed < 0 ? -1 : 1,
  }))
}

/**
 * The group's px spans on one row, one per run of placements the row shows, as
 * ORDERED pairs: the end corresponding to the anchor's start first. Empty when
 * the row's frame shows nothing of the group, which is what makes a ribbon skip
 * a row rather than draw to nowhere.
 *
 * Ordered rather than ascending because that is the whole of drawing an
 * inversion. `ribbonPath` joins first end to first end, so a pair reversed here
 * draws the crossed parallelogram a reverse-strand block IS, and two lanes both
 * reversed against the anchor draw an untwisted ribbon between themselves —
 * relative orientation composes without anyone multiplying it out. `flipped`
 * rides along for free: `rowFrameX` already mirrors a flipped lane.
 *
 * A caller drawing a BOX wants the two ends the other way round; sort there.
 */
export function groupSpansOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
): Span[] {
  // every run holds a placement the frame shows, so `frameSpan` always answers
  return groupRunsOnRow(group, assemblyName, frame).map(run => {
    const [a, b] = frameSpan(frame, run.min, run.max, width)!
    return run.orientation < 0 ? ([b, a] as const) : ([a, b] as const)
  })
}

// Every bp position a lane's frame can occupy. The frame always covers
// [fitMin, fitMax] and its span is fixed by the ladder rung, so the alignment
// shift can only slide it inside this window — which makes the window itself
// independent of both the shift and the viewport width.
export function laneFetchWindow(frame: RowFrame) {
  const span = frame.max - frame.min
  return {
    min: Math.min(frame.min, frame.fitMax - span),
    max: Math.max(frame.max, frame.fitMin + span),
  }
}

// The region a lane's dependent fetches ask for: the window the frame can slide
// in, widened to a power-of-two grid so a sub-grid pan reuses the last fetch.
// Keyed on the window rather than the frame because the frame moves with the
// alignment shift and with the viewport width, and a lane must not refetch its
// annotation because the browser window was resized.
//
// The grid comes off the RUNG SPAN alone. Taken off the window's own width it
// moves with the fitted extent, and that width ranges over [span, 2*span) —
// which straddles a power of two, so one more ortholog entering the viewport
// could double the grid and refetch every lane for a gesture that moved no
// frame.
export function laneFetchRegion(frame: RowFrame) {
  const { min, max } = laneFetchWindow(frame)
  const grid =
    2 ** Math.ceil(Math.log2(Math.max(2 * (frame.max - frame.min), 1)))
  return {
    refName: frame.refName,
    start: Math.max(0, Math.floor(min / grid) * grid),
    end: Math.ceil(max / grid) * grid,
  }
}
