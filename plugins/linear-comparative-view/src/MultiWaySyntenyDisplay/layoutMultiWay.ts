import { clamp, dedupe, doesIntersect2 } from '@jbrowse/core/util'

import {
  OUTLIER_REACH,
  keepNearMedian,
  weightedMedian,
} from '../keepNearMedian.ts'

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
  // the freedom `alignRowFrames` works in
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

function mid(p: MultiWayPlacement) {
  return (p.start + p.end) / 2
}

// The scales a lane's frame is allowed to sit at, as multiples of the anchor's
// visible span. Fitting a lane exactly to its placements gives it an arbitrary
// bp/px that also MOVES: one more ortholog entering the window re-fits the
// frame, so the lane's content slides under its own ribbons on every pan. The
// first rung is the "never zoom in past the anchor" clamp.
const SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]

// The frame's span rounded up to a ladder rung and its center snapped to an
// eighth of that span, held to the centers that still cover [lo, hi] — a frame
// that misses its own fit misses it silently, since everything downstream reads
// the frame as covering the fit. `unitBp` of 0 means the caller has no anchor
// span to scale against and the fitted frame passes through.
function snapFrameToLadder(lo: number, hi: number, unitBp: number) {
  if (unitBp <= 0) {
    return { min: lo, max: hi }
  }
  const wanted = Math.max(hi - lo, unitBp)
  const rung = SCALE_LADDER.find(multiple => multiple * unitBp >= wanted)
  const span =
    rung === undefined ? Math.ceil(wanted / unitBp) * unitBp : rung * unitBp
  const grid = span / 8
  const half = span / 2
  const center = clamp(
    Math.round((lo + hi) / 2 / grid) * grid,
    hi - half,
    lo + half,
  )
  // slide the span back inside the contig rather than clamping `min` alone, so
  // a lane near a contig start keeps the rung it was snapped to
  const min = Math.max(0, center - half)
  return { min, max: min + span }
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

// The x positions of the shared tick interval inside one lane's own frame.
export function frameTickXs(frame: RowFrame, interval: number, width: number) {
  const xs: number[] = []
  if (interval > 0 && (frame.max - frame.min) / interval <= MAX_LANE_TICKS) {
    for (
      let bp = Math.ceil(frame.min / interval) * interval;
      bp <= frame.max;
      bp += interval
    ) {
      xs.push(rowFrameX(frame, bp, width))
    }
  }
  return xs
}

// The row's own coordinate frame: the dominant refName among the visible
// groups' placements, the padded bp span those placements cover, and whether
// the row reads back-to-front relative to the anchor's gene order. This is what
// makes the display non-reference-anchored — each row is laid out in its own
// frame and only the ribbons carry the correspondence.
export function computeRowFrame(
  groups: MultiWayGroup[],
  assemblyName: string,
  minSpanBp = 0,
): RowFrame | undefined {
  // Each contig weighed by how much of the ANCHOR it explains, not by a count
  // of placements: a handful of short repeat hits outnumbers the few long
  // syntenic blocks that are the lane. Anchor-side rather than mate-side
  // because the reader is looking at the anchor window and the honest question
  // is which contig covers it — and because that is the vote `resolvePanel`
  // runs, on the same axis, for the panel this lane launches.
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
  let dominant: string | undefined
  let dominantBp = 0
  for (const [refName, bp] of anchorBp) {
    if (bp > dominantBp) {
      dominant = refName
      dominantBp = bp
    }
  }
  if (dominant === undefined) {
    return undefined
  }
  const placements = keepNearMedian(
    byRef.get(dominant)!,
    minSpanBp > 0 ? minSpanBp * OUTLIER_REACH : Number.POSITIVE_INFINITY,
    p => p,
  )
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  let orientation = 0
  let prev: number | undefined
  for (const group of groups) {
    const p = group.mates.get(assemblyName)?.find(m => m.refName === dominant)
    if (p) {
      const m = mid(p)
      if (prev !== undefined) {
        orientation += Math.sign(m - prev)
      }
      prev = m
    }
  }
  const pad = Math.max((max - min) * 0.02, 1)
  const lo = Math.max(0, min - pad)
  const hi = max + pad
  const snapped = snapFrameToLadder(lo, hi, minSpanBp)
  return {
    refName: dominant,
    min: snapped.min,
    max: snapped.max,
    flipped: orientation < 0,
    fitMin: lo,
    fitMax: hi,
  }
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

// What a lane draws from a gene track's top-level features. An NCBI-style GFF3
// also carries a `region` row spanning the whole sequence, which would paint
// the lane end to end; prefer the gene-typed features, and fall back to
// everything that is not a whole-sequence container for annotations whose top
// level is transcripts. Deduped first: the anchor lane is fetched over the
// view's static blocks, and a gene straddling a boundary comes back once per
// block it touches.
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(features: Feature[]) {
  const unique = dedupe(features, f => f.id())
  const genes = unique.filter(f => !!f.get('type')?.endsWith('gene'))
  return genes.length
    ? genes
    : unique.filter(f => {
        const type = f.get('type')
        return type === undefined || !CONTAINER_TYPES.has(type)
      })
}

/**
 * Does a lane's own annotation already draw over this span?
 *
 * A lane draws gene models where it has them and the table's placement boxes
 * where it does not, and the choice is per GROUP rather than per lane. Made per
 * lane it left a ribbon hanging off nothing wherever an annotation named only
 * some of the table's genes — the ordinary case rather than a corner, since the
 * table and the GFF3 are different releases: the demo's blocks file pairs four
 * grape genes and the grape GFF3 names two.
 *
 * Px rather than bp so one rule covers both kinds of lane: the anchor lane's
 * genes and its group spans both come through the view's axis, a mate lane's
 * both come through its frame, and neither pair is comparable in bp with the
 * other.
 */
export function isAnnotated(annotated: Span[], span: Span) {
  const lo = Math.min(span[0], span[1])
  const hi = Math.max(span[0], span[1])
  return annotated.some(a =>
    doesIntersect2(Math.min(a[0], a[1]), Math.max(a[0], a[1]), lo, hi),
  )
}

function mergeIntervals(intervals: [number, number][]) {
  intervals.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [start, end] of intervals) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}

function subtractIntervals(base: [number, number][], cut: [number, number][]) {
  const out: [number, number][] = []
  for (const [start, end] of base) {
    let cursor = start
    for (const [cutStart, cutEnd] of cut) {
      if (cutEnd <= cursor || cutStart >= end) {
        continue
      }
      if (cutStart > cursor) {
        out.push([cursor, cutStart])
      }
      cursor = Math.max(cursor, cutEnd)
    }
    if (cursor < end) {
      out.push([cursor, end])
    }
  }
  return out
}

export interface GeneGlyphShape {
  // the merged CDS across the gene's transcripts, or the merged exons of a
  // non-coding gene, or the whole span of a structureless feature — so a plain
  // BED-backed gene still draws as one box
  full: [number, number][]
  // the untranslated parts of the merged exons, drawn thinner
  thin: [number, number][]
}

// A gene's drawable shape, merged across its transcripts: exon and CDS
// intervals collected from the whole subtree, the CDS full-height and the
// exon-minus-CDS remainder as UTR.
export function geneGlyphShape(feature: Feature): GeneGlyphShape {
  const exons: [number, number][] = []
  const cds: [number, number][] = []
  const walk = (f: Feature) => {
    for (const sub of f.get('subfeatures') ?? []) {
      const type = sub.get('type')
      if (type === 'exon') {
        exons.push([sub.get('start'), sub.get('end')])
      } else if (type === 'CDS') {
        cds.push([sub.get('start'), sub.get('end')])
      }
      walk(sub)
    }
  }
  walk(feature)
  const mergedCds = mergeIntervals(cds)
  const mergedExons = exons.length
    ? mergeIntervals(exons)
    : mergedCds.length
      ? mergedCds
      : [[feature.get('start'), feature.get('end')] as [number, number]]
  return exons.length && mergedCds.length
    ? { full: mergedCds, thin: subtractIntervals(mergedExons, mergedCds) }
    : { full: mergedExons, thin: [] }
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
function groupRunsOnRow(
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

// The whole footprint the group occupies on one row — what the lane-alignment
// pass lines up against, where a duplicated gene's several copies are one
// group's worth of evidence rather than several.
function groupExtentOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
) {
  const runs = groupRunsOnRow(group, assemblyName, frame)
  return runs.length ? { min: runs[0]!.min, max: runs.at(-1)!.max } : undefined
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
  return { min: frame.fitMax - span, max: frame.fitMin + span }
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

interface LanePlacement {
  key: string
  center: number
  weight: number
}

// What one lane offers the lane below it to line up against: a bp center and a
// length per group the frame shows.
function lanePlacements(
  groups: MultiWayGroup[],
  assemblyName: string,
  frame: RowFrame,
): LanePlacement[] {
  const out: LanePlacement[] = []
  for (const group of groups) {
    const extent = groupExtentOnRow(group, assemblyName, frame)
    if (extent) {
      out.push({
        key: group.key,
        center: (extent.min + extent.max) / 2,
        weight: Math.max(extent.max - extent.min, 1),
      })
    }
  }
  return out
}

// how many groups two lanes must share before their shared order is trusted
// over the anchor-order orientation `computeRowFrame` already worked out
const MIN_SHARED_FOR_ORIENTATION = 3

// Does this lane read the same direction as the one above it? Walk the shared
// groups in the UPPER lane's drawn order and sum the direction each consecutive
// step takes in this one, weighting a pair by its shorter member. Against the
// lane above rather than the anchor, because that is the pair the ribbons are
// drawn between.
//
// `undefined` IS AN ANSWER, and a balanced vote is one — an inverted duplication
// puts as much weight each way, and `concordance < 0` read that as forwards and
// asserted it over `computeRowFrame`'s anchor-order orientation, which is
// evidence of its own and the thing this defers to when it has none. Too few
// shared groups and a tie are the same state: this pair says nothing about which
// way the lane runs.
function readsBackwards(
  upperX: Map<string, number>,
  lane: LanePlacement[],
): boolean | undefined {
  const shared = lane
    .filter(p => upperX.has(p.key))
    .sort((a, b) => upperX.get(a.key)! - upperX.get(b.key)!)
  if (shared.length < MIN_SHARED_FOR_ORIENTATION) {
    return undefined
  }
  let concordance = 0
  for (let i = 1; i < shared.length; i++) {
    const a = shared[i - 1]!
    const b = shared[i]!
    concordance += Math.sign(b.center - a.center) * Math.min(a.weight, b.weight)
  }
  return concordance === 0 ? undefined : concordance < 0
}

// A lane slides in whole multiples of this, so the median moving by a pixel or
// two as a pan swaps one group for another cannot slide the whole lane
const SHIFT_QUANTUM_PX = 8

// Where a lane sits horizontally. Splitting a lane's bp->px map into a scale
// and an offset lets the two be chosen for different reasons — the scale off
// the ladder, for honesty, and the offset here, for legibility. Minimizing the
// total ribbon travel `sum |x_upper(g) - x_lane(g)|` over a fixed scale is an L1
// problem, and because a ribbon only ever joins ADJACENT lanes the objective is
// a chain: one independent choice per lane, each the weighted median of the
// displacement to the lane above. Median rather than mean so one stray
// placement cannot drag a lane.
//
// The shift is held to slack that keeps the frame over its own fitted extent
// AND at or above zero, the floor `snapFrameToLadder` fits to.
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
  const wanted =
    Math.round(weightedMedian(samples) / SHIFT_QUANTUM_PX) * SHIFT_QUANTUM_PX
  const span = frame.max - frame.min
  const shift = clamp(
    ((frame.flipped ? 1 : -1) * wanted * span) / width,
    Math.max(Math.min(0, frame.fitMax - frame.max), -frame.min),
    Math.max(0, frame.fitMin - frame.min),
  )
  return { ...frame, min: frame.min + shift, max: frame.max + shift }
}

// Every lane's frame, walked top down so each one is oriented and positioned
// against the lane above it — the pair its ribbons are actually drawn between.
// A lane with no frame does not break the chain: the next lane still lines up
// against the last lane that has one.
//
// `anchorSeedX` is where the anchor lane actually draws each group, in screen
// px, off the view's own `bpToPx`. A `RowFrame` cannot stand in for it: a frame
// is one linear ramp, and the view's mapping is piecewise over displayed
// regions, with seams, reversed regions and elisions.
export function alignRowFrames(
  groups: MultiWayGroup[],
  assemblyNames: string[],
  anchorSeedX: Map<string, number> | undefined,
  minSpanBp: number,
  width: number,
) {
  const frames = new Map<string, RowFrame | undefined>()
  let upperX = anchorSeedX && width > 0 ? anchorSeedX : undefined
  for (const assemblyName of assemblyNames) {
    const fitted = computeRowFrame(groups, assemblyName, minSpanBp)
    if (fitted === undefined || upperX === undefined) {
      frames.set(assemblyName, fitted)
      continue
    }
    // one list for both steps: flipping a frame changes which END of the lane a
    // bp lands on, not which placements the frame shows
    const placements = lanePlacements(groups, assemblyName, fitted)
    const backwards = readsBackwards(upperX, placements)
    const oriented =
      backwards === undefined ? fitted : { ...fitted, flipped: backwards }
    const frame = alignFrameTo(upperX, placements, oriented, width)
    frames.set(assemblyName, frame)
    upperX = new Map(
      lanePlacements(groups, assemblyName, frame).map(p => [
        p.key,
        rowFrameX(frame, p.center, width),
      ]),
    )
  }
  return frames
}

const LABEL_HEIGHT = 12
const MIN_GLYPH_PX = 5
const MAX_GLYPH_PX = 18

export interface LaneBand {
  glyphTop: number
  bandTop: number
  bandStart: number
  bandEnd: number
}

export interface LaneGeometry {
  glyphHeight: number
  bandHeight: number
  rows: LaneBand[]
}

// Where each lane's header, glyphs and opaque band sit in a track `height` px
// tall. The bands TILE — a lane owns half the gutter on each side — so the
// view's gridlines, true on the anchor lane and a lie on every other one, are
// covered everywhere below the anchor rather than standing in the gaps.
export function laneGeometry(height: number, rowCount: number): LaneGeometry {
  const glyphHeight = clamp(
    height / rowCount - LABEL_HEIGHT - 6,
    MIN_GLYPH_PX,
    MAX_GLYPH_PX,
  )
  const usable = height - LABEL_HEIGHT - glyphHeight - 4
  const glyphTop = (row: number) =>
    LABEL_HEIGHT + (rowCount === 1 ? 0 : (row * usable) / (rowCount - 1))
  const bandStart = (row: number) =>
    row === 0
      ? 0
      : (glyphTop(row - 1) + glyphHeight + glyphTop(row) - LABEL_HEIGHT) / 2
  return {
    glyphHeight,
    bandHeight: LABEL_HEIGHT + glyphHeight,
    rows: Array.from({ length: rowCount }, (_, row) => ({
      glyphTop: glyphTop(row),
      bandTop: glyphTop(row) - LABEL_HEIGHT,
      bandStart: bandStart(row),
      bandEnd: row + 1 < rowCount ? bandStart(row + 1) : height,
    })),
  }
}
