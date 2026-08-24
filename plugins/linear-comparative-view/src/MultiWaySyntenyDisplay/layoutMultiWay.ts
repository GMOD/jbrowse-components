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

// how far, in multiples of the anchor's visible span, a placement may sit
// from the length-weighted median placement and still shape the lane's frame
const OUTLIER_REACH = 1.5

function keepPlacementsNearMedian(
  placements: MultiWayPlacement[],
  reachBp: number,
) {
  const sorted = [...placements].sort((a, b) => mid(a) - mid(b))
  const total = sorted.reduce((sum, p) => sum + (p.end - p.start), 0)
  let acc = 0
  let center = mid(sorted[0]!)
  for (const p of sorted) {
    acc += p.end - p.start
    if (acc >= total / 2) {
      center = mid(p)
      break
    }
  }
  const kept = sorted.filter(p => Math.abs(mid(p) - center) <= reachBp)
  return kept.length ? kept : sorted
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
  // Alignment-level sources carry repeat noise: a handful of short records
  // whose mate lands megabases from the block everything else agrees on, and
  // a min/max frame over them stretches the lane across the whole genome. The
  // frame therefore centers on the length-weighted median placement and keeps
  // only the placements within a window-scaled reach of it — a clean gene
  // table passes through unchanged, since all its placements agree.
  const placements = keepPlacementsNearMedian(
    byRef.get(dominant)!,
    minSpanBp > 0 ? minSpanBp * OUTLIER_REACH : Number.POSITIVE_INFINITY,
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

// The group's merged [x1, x2] px span on one row, or undefined when the group
// has nothing on that row's dominant refName — which is what makes a ribbon
// skip a row rather than draw to nowhere
export function groupSpanOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
) {
  const placements = group.mates
    .get(assemblyName)
    ?.filter(p => p.refName === frame.refName)
  if (!placements?.length) {
    return undefined
  }
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const p of placements) {
    min = Math.min(min, p.start)
    max = Math.max(max, p.end)
  }
  const a = rowFrameX(frame, min, width)
  const b = rowFrameX(frame, max, width)
  return a < b ? ([a, b] as const) : ([b, a] as const)
}
