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

/**
 * The view's content blocks as the regions a clipping fetch asks for: blocks
 * that abut on one refName become one region, so a record spanning two blocks
 * is cut once rather than once per block, and every edge is snapped outward to
 * a whole base, since a block is a span of screen and a clip names bases.
 */
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
  /** the gene the placement is, where the source names one */
  name?: string
}

/**
 * A mate placement plus how it runs against the anchor. `orientation` is the
 * PAIR's strand — the alignment strand for PAF, the product of the two BED
 * strands for an MCScan row — which a pairwise feature carries as its own
 * `strand` and a grouped feature carries per entry of `mates`. Never the
 * `strand` inside a mate object, which PAF does not set and the MCScan blocks
 * adapter fills with the mate gene's transcription strand. -1 means the two
 * ends of the pair correspond crosswise, so an inversion's ribbon twists.
 */
export interface MatePlacement extends MultiWayPlacement {
  orientation: number
}

export interface MultiWayGroup {
  key: string
  anchor: MultiWayPlacement
  mates: Map<string, MatePlacement[]>
  feature: Feature
  /**
   * What the group counts for in a contig vote: the anchor bp of an
   * alignment record, where a 2 Mb block has to outweigh twenty repeat hits,
   * and one per gene for a named source, where a 1.4 Mb gene is one gene.
   * DPP10 alone otherwise carried the chimp lane onto chr2B against fifteen
   * genes on chr2A at the human chr2 fusion.
   */
  weight: number
}

export interface RowFrame {
  refName: string
  min: number
  max: number
  flipped: boolean
  // the extent the frame was fitted to, before the ladder rounded its span.
  // The alignment slides the frame off its centre, so part of this can fall
  // past either edge
  fitMin: number
  fitMax: number
  // the lane's other contigs explaining a comparable share of the anchor
  // window — a second homoeologous copy, most often — which the frame shows
  // nothing of. Named so the reader can pin the lane onto one. Capped, since
  // a fragmented assembly has as many of these as it has scaffolds; the ones
  // past the cap are counted rather than named.
  alsoOn: string[]
  alsoOnMore: number
  // while a transition runs, the frames the lane is moving from, each with its
  // share of where the lane draws. The lane's cells are packed in this frame
  // and culled to all of them, so the transition's first picture is the old
  // one rather than the new frame's content with its edges missing
  morphFrom?: readonly { frame: RowFrame; weight: number }[]
}

// Both fetch shapes as one list: a grouped feature's `mates` carry their own
// orientation, a pairwise feature's one `mate` takes the feature's `strand`.
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
// features name for it, whether one feature carries them all (`mates`) or one
// feature carries each (`mate`). A reference-anchored table repeats a mate
// through each row that reaches it, so placements dedupe on coordinates.
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
 * The group as the VIEWPORT sees it: the anchor interval cut to
 * [start, end], and each mate cut by the same two fractions of its own length,
 * from whichever of its ends the anchor's cut corresponds to.
 *
 * The fetch asks for the view's STATIC blocks, which reach up to a whole block
 * past the window on either side, and `clipToRegion` cuts each record to what
 * was ASKED FOR — so a record that spans the window arrives spanning the
 * padded region too, and a lane fitted to it is fitted to the padding. A PAF
 * of small records never showed it, since one record's overhang is a few kb
 * against a window's worth of others; a graph adapter answers one record per
 * haplotype and the overhang IS the fit. The HPRC CFH window (260 kb, hg38
 * chr1:196.64-196.90 Mb, 416 kb of static blocks behind it) put every
 * matching haplotype at 2x the window and every CFHR3-CFHR1 deletion carrier
 * at 1.5x, each drawing its own gene models across sequence the anchor window
 * does not reach and no ribbon can join.
 *
 * By PROPORTION because that is all a clipped record can say: the alignment
 * strings are what made it expensive to ship and the clip drops them. Over the
 * near-identity records this matters for, the two axes run at one rate anyway,
 * and the ladder rounds what is left. A group already inside the window comes
 * back as it is, which is every group of a gene table and nearly every one of
 * a small-record PAF.
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

// Whether a group can gather placements from several lanes — a gene keyed by
// its name across the pair tables, or a folded record carrying several mates —
// so a lane that places nothing for it is a lane the group is missing from. A
// one-record alignment holds exactly its one mate: no other lane ever had it,
// and bridging it fans the anchor to every lane over the pairs' direct links.
export function groupSpansLanes(group: MultiWayGroup) {
  return group.mates.size > 1 || isNamedRecord(group.feature)
}

// Mate assemblies densest-first over the anchor-sorted groups: a ribbon
// connects ADJACENT lanes only, so a near-empty lane sitting mid-stack cuts the
// chains of every denser lane below it. A lane's density is its heaviest
// contig's evidence, what `pickContig` votes with — one per gene on a named
// table, anchor bp on an alignment — since a lane draws one contig, and a
// genome scattering the window over ten scaffolds is as sparse as the one it
// shows. Weighed over the whole fetched block set rather than the viewport, so
// the order holds still across the pans that keep one fetch. `preferred` (the
// display's domain) pins the lanes it names to the top, in its order — joined
// on `keyOf`, the canonical name, because a session spec spells an assembly
// the way the session does while a placement spells it the way the table's BED
// did.
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

function framesOf(frame: RowFrame) {
  return [frame, ...(frame.morphFrom ?? []).map(from => from.frame)]
}

/** the bp the lane shows: its frame, and every frame a transition moves it from */
export function frameExtent(frame: RowFrame) {
  let { min, max } = frame
  for (const from of frame.morphFrom ?? []) {
    min = Math.min(min, from.frame.min)
    max = Math.max(max, from.frame.max)
  }
  return { min, max }
}

/** the extent plus the half screen either side a pan reveals before relayout */
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

/**
 * The most a transition magnifies the lane's packed px: a frame showing less
 * than this one draws each px wider than it was packed
 */
export function frameMagnification(frame: RowFrame) {
  const span = frame.max - frame.min
  return Math.max(1, ...framesOf(frame).map(f => span / (f.max - f.min)))
}

// The x positions of the shared tick interval over a lane's reach, drawn while
// any frame the lane shows would draw them.
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

/**
 * One bp interval in a lane's own frame, as a px pair in the interval's own
 * order, or undefined when the lane's reach shows nothing of it.
 *
 * CLIPPED TO `frameReach`, not merely tested against it. `rowFrameX`
 * extrapolates, so an unclipped end maps to tens of thousands of pixels and
 * the ribbon keeping it sweeps across everything.
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
  const { min, max } = frameReach(frame)
  return doesIntersect2(min, max, start, end)
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
  /** the one gene the run's placements name, if they name exactly one */
  name?: string
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
  const { min, max } = frameExtent(frame)
  const placements = (group.mates.get(assemblyName) ?? [])
    .filter(
      p =>
        p.refName === frame.refName && doesIntersect2(min, max, p.start, p.end),
    )
    .sort((a, b) => a.start - b.start)
  // length-weighted within a run, so a fragment aligning the other way cannot
  // outvote the block it sits inside
  const runs: {
    min: number
    max: number
    signed: number
    names: Set<string | undefined>
  }[] = []
  for (const p of placements) {
    const weight = p.orientation * Math.max(p.end - p.start, 1)
    const last = runs.at(-1)
    if (last && p.start <= last.max) {
      last.max = Math.max(last.max, p.end)
      last.signed += weight
      last.names.add(p.name)
    } else {
      runs.push({
        min: p.start,
        max: p.end,
        signed: weight,
        names: new Set([p.name]),
      })
    }
  }
  return runs.map(({ min, max, signed, names }) => ({
    min,
    max,
    orientation: signed < 0 ? -1 : 1,
    name: names.size === 1 ? [...names][0] : undefined,
  }))
}

/**
 * The group's px spans on one row, one per run of placements the row shows, as
 * ORDERED pairs: the end corresponding to the anchor's start first. Empty when
 * the row's frame shows nothing of the group, so the ribbon skips that row.
 *
 * Ordered, not ascending, because the order is how an inversion is drawn. `ribbonPath` joins first end to first end, so a pair reversed here
 * draws the crossed parallelogram a reverse-strand block IS, and two lanes both
 * reversed against the anchor draw an untwisted ribbon between themselves —
 * relative orientation composes without anyone multiplying it out. `flipped`
 * needs no extra handling: `rowFrameX` already mirrors a flipped lane.
 *
 * A caller drawing a BOX wants the two ends the other way round; sort there.
 */
export function groupRunSpansOnRow(
  group: MultiWayGroup,
  assemblyName: string,
  frame: RowFrame,
  width: number,
): { span: Span; orientation: number; interval: MultiWayPlacement }[] {
  // every run holds a placement the frame shows, so `frameSpan` always answers
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
    }
  })
}

// The frame joined with every position its span can take while covering
// [fitMin, fitMax], so an alignment shift inside that range leaves the fetch
// where it was, whatever the viewport width
export function laneFetchWindow(frame: RowFrame) {
  const span = frame.max - frame.min
  return {
    min: Math.min(frame.min, frame.fitMax - span),
    max: Math.max(frame.max, frame.fitMin + span),
  }
}

// The region a lane's dependent fetches ask for: `laneFetchWindow` plus the
// half screen `frameReach` draws either side of it, widened to a power-of-two
// grid so a sub-grid pan reuses the last fetch, and never below 0, which a
// lane whose contig starts inside the window draws as blank.
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
  const span = frame.max - frame.min
  const grid = 2 ** Math.ceil(Math.log2(Math.max(2 * span, 1)))
  return {
    refName: frame.refName,
    start: Math.max(0, Math.floor((min - span / 2) / grid) * grid),
    end: Math.ceil((max + span / 2) / grid) * grid,
  }
}
