import { clamp, doesIntersect2 } from '@jbrowse/core/util'

import { OUTLIER_REACH, keepNearMedian } from '../keepNearMedian.ts'

import type { Feature } from '@jbrowse/core/util'

export interface MultiWayPlacement {
  refName: string
  start: number
  end: number
  strand: number
  name: string
}

export interface MultiWayGroup {
  key: string
  name: string
  anchor: MultiWayPlacement
  mates: Map<string, MultiWayPlacement[]>
  feature: Feature
}

export interface RowFrame {
  refName: string
  min: number
  max: number
  flipped: boolean
  // The extent of the placements the frame was fitted to, before the ladder
  // rounded the span up. The frame may slide anywhere that still covers this,
  // and that difference is the whole freedom `alignRowFrames` works in.
  fitMin: number
  fitMax: number
}

interface MatePlacement extends MultiWayPlacement {
  assemblyName: string
}

function mateOf(feature: Feature) {
  return feature.get('mate') as MatePlacement
}

// The cross-assembly identity the placements group on: the gene name, falling
// back to the adapter's syntenyId for sources that carry no names. Name first
// because an MCScan blocks adapter keeps the FIRST row naming a gene pair, so
// one anchor gene can surface under different row numbers on different pairs
// while its name is one string everywhere
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
    const name = feature.get('name') ?? key
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        name,
        anchor: {
          refName: feature.get('refName'),
          start: feature.get('start'),
          end: feature.get('end'),
          strand: feature.get('strand') ?? 0,
          name,
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
        strand: mate.strand,
        name: mate.name,
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
// the pans that keep one fetch. A non-empty `preferred` (the display's rowOrder
// property) pins the lanes it names to the top, in its order.
export function rowAssembliesOf(groups: MultiWayGroup[], preferred: string[]) {
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
  return [
    ...preferred.filter(assemblyName => present.includes(assemblyName)),
    ...present.filter(assemblyName => !preferred.includes(assemblyName)),
  ]
}

function mid(p: MultiWayPlacement) {
  return (p.start + p.end) / 2
}

// The scales a lane's frame is allowed to sit at, as multiples of the anchor's
// visible span. Fitting a lane exactly to its placements gives it an arbitrary
// bp/px that also MOVES: one more ortholog entering the window re-fits the
// frame, so the lane's content slides under its own ribbons on every pan and
// the scale a reader just worked out is stale. Snapping to a short ladder makes
// the scale one of a handful of legible values, holds a lane still under a pan
// that does not change its rung, and lets the header name it as a round
// multiple. The first rung is the old "never zoom in past the anchor" clamp.
const SCALE_LADDER = [1, 1.5, 2, 3, 5, 8, 12, 20, 40, 80]

// The frame's span rounded up to a ladder rung and its center snapped to an
// eighth of that span. `unitBp` of 0 means the caller has no anchor span to
// scale against (the layout unit tests), and the fitted frame passes through.
function snapFrameToLadder(lo: number, hi: number, unitBp: number) {
  if (unitBp <= 0) {
    return { min: lo, max: hi }
  }
  const wanted = Math.max(hi - lo, unitBp)
  const rung = SCALE_LADDER.find(multiple => multiple * unitBp >= wanted)
  const span =
    rung === undefined ? Math.ceil(wanted / unitBp) * unitBp : rung * unitBp
  const grid = span / 8
  const center = Math.round((lo + hi) / 2 / grid) * grid
  return { min: center - span / 2, max: center + span / 2 }
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
  const byRef = new Map<string, MultiWayPlacement[]>()
  for (const group of groups) {
    for (const p of group.mates.get(assemblyName) ?? []) {
      let bucket = byRef.get(p.refName)
      if (!bucket) {
        bucket = []
        byRef.set(p.refName, bucket)
      }
      bucket.push(p)
    }
  }
  let dominant: string | undefined
  let dominantCount = 0
  for (const [refName, placements] of byRef) {
    if (placements.length > dominantCount) {
      dominant = refName
      dominantCount = placements.length
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
  const lo = min - pad
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

// What a lane draws from a gene track's top-level features. An NCBI-style
// GFF3 also carries a `region` row spanning the whole sequence, which would
// paint the lane end to end; prefer the gene-typed features, and fall back to
// everything that is not a whole-sequence container for annotations whose
// top level is transcripts.
const CONTAINER_TYPES = new Set(['region', 'chromosome', 'contig', 'scaffold'])

export function laneGeneFeatures(features: Feature[]) {
  const genes = features.filter(f => !!f.get('type')?.endsWith('gene'))
  return genes.length
    ? genes
    : features.filter(f => {
        const type = f.get('type')
        return type === undefined || !CONTAINER_TYPES.has(type)
      })
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
  // full-height intervals: the merged CDS across the gene's transcripts, or
  // the merged exons of a non-coding gene, or the whole span of a structure-
  // less feature — so a plain BED-backed gene still draws as one box
  full: [number, number][]
  // the untranslated parts of the merged exons, drawn thinner in the UTR
  // color the way the canvas gene track draws them
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

// The group's placements on one row, in bp, restricted to the ones the frame
// actually shows.
//
// The frame filter is the load-bearing part. `computeRowFrame` throws out the
// repeat hit that lands megabases away so it cannot stretch the lane — and
// without the same filter here that placement came straight back as a drawn
// span. `rowFrameX` extrapolates, so a mate 900 kb outside an 88 kb frame maps
// to tens of thousands of pixels: the rect is clipped by the svg and looks
// fine, while the RIBBON keeps that endpoint and sweeps across the whole page.
function groupExtentOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
) {
  const placements = group.mates
    .get(assemblyName)
    ?.filter(
      p =>
        p.refName === frame.refName &&
        doesIntersect2(frame.min, frame.max, p.start, p.end),
    )
  if (!placements?.length) {
    return undefined
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  return { min, max }
}

// The group's merged [x1, x2] px span on one row, or undefined when the row's
// frame shows nothing of it — which is what makes a ribbon skip a row rather
// than draw to nowhere
export function groupSpanOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
) {
  const extent = groupExtentOnRow(group, assemblyName, frame)
  if (extent === undefined) {
    return undefined
  }
  const a = rowFrameX(frame, extent.min, width)
  const b = rowFrameX(frame, extent.max, width)
  return a < b ? ([a, b] as const) : ([b, a] as const)
}

// Every bp position a lane's frame can occupy. The frame always covers
// [fitMin, fitMax] and its span is fixed by the ladder rung, so the alignment
// shift can only slide it inside this window — which makes the window itself
// independent of both the shift and the viewport width. That is what a fetch
// has to be keyed on: a lane's annotation must not refetch because the browser
// window was resized, or because one more ortholog moved the alignment median
// past its quantum.
export function laneFetchWindow(frame: RowFrame) {
  const span = frame.max - frame.min
  return { min: frame.fitMax - span, max: frame.fitMin + span }
}

interface LanePlacement {
  key: string
  center: number
  weight: number
}

// What one lane offers the lane below it to line up against: a bp center and a
// length per group the frame shows. The anchor lane's placements come off the
// groups' own anchor coordinates rather than a mate list.
function lanePlacements(
  groups: MultiWayGroup[],
  assemblyName: string | undefined,
  frame: RowFrame,
): LanePlacement[] {
  const out: LanePlacement[] = []
  for (const group of groups) {
    const extent =
      assemblyName === undefined
        ? group.anchor.refName === frame.refName &&
          doesIntersect2(
            frame.min,
            frame.max,
            group.anchor.start,
            group.anchor.end,
          )
          ? { min: group.anchor.start, max: group.anchor.end }
          : undefined
        : groupExtentOnRow(group, assemblyName, frame)
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
// step takes in this one, weighting a pair by its shorter member — a pair of
// long syntenic genes says more about the direction than a pair of fragments.
// Against the lane above rather than the anchor, because that is the pair the
// ribbons are drawn between.
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
  return concordance < 0
}

function weightedMedian(samples: { value: number; weight: number }[]) {
  const sorted = [...samples].sort((a, b) => a.value - b.value)
  const total = sorted.reduce((sum, s) => sum + s.weight, 0)
  let acc = 0
  for (const sample of sorted) {
    acc += sample.weight
    if (acc >= total / 2) {
      return sample.value
    }
  }
  return 0
}

// A lane slides in whole multiples of this, so the median moving by a pixel or
// two as a pan swaps one group for another cannot slide the whole lane
const SHIFT_QUANTUM_PX = 8

// Where a lane sits horizontally was, until this pass, an accident: the frame
// started at the leftmost placement, which has nothing to do with where the
// ribbons want to go. Splitting the lane's bp->px map into a scale and an
// offset lets the two be chosen for different reasons — the scale off the
// ladder, for honesty, and the offset here, for legibility.
//
// Minimizing the total ribbon travel `sum |x_upper(g) - x_lane(g)|` over a fixed
// scale is an L1 problem, and because a ribbon only ever joins ADJACENT lanes
// the objective is a chain: it decomposes into one independent choice per lane,
// walked top down, and each choice is the weighted median of the displacement
// to the lane above. Median rather than mean so one stray placement cannot drag
// a lane, and the shift is clamped to the slack the ladder rung left over the
// fitted extent so a lane can never slide its own content off its edge.
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
    Math.min(0, frame.fitMax - frame.max),
    Math.max(0, frame.fitMin - frame.min),
  )
  return { ...frame, min: frame.min + shift, max: frame.max + shift }
}

// Every lane's frame, walked top down so each one is oriented and positioned
// against the lane above it — the pair its ribbons are actually drawn between.
// A lane with no frame does not break the chain: the next lane still lines up
// against the last lane that has one.
export function alignRowFrames(
  groups: MultiWayGroup[],
  assemblyNames: string[],
  anchorFrame: RowFrame | undefined,
  minSpanBp: number,
  width: number,
) {
  const frames = new Map<string, RowFrame | undefined>()
  let upperX =
    anchorFrame && width > 0
      ? new Map(
          lanePlacements(groups, undefined, anchorFrame).map(p => [
            p.key,
            rowFrameX(anchorFrame, p.center, width),
          ]),
        )
      : undefined
  for (const assemblyName of assemblyNames) {
    const fitted = computeRowFrame(groups, assemblyName, minSpanBp)
    if (fitted === undefined || upperX === undefined) {
      frames.set(assemblyName, fitted)
      continue
    }
    const backwards = readsBackwards(
      upperX,
      lanePlacements(groups, assemblyName, fitted),
    )
    const oriented =
      backwards === undefined ? fitted : { ...fitted, flipped: backwards }
    const placements = lanePlacements(groups, assemblyName, oriented)
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
