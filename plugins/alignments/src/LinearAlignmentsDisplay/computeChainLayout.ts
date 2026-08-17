import Flatbush from '@jbrowse/core/util/flatbush'

import {
  cloneWithLayout,
  extendRefNameSpan,
  placeRectCapped,
  refNameAxisShift,
  withoutLayout,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import { isChainData } from '../RenderAlignmentDataRPC/types.ts'
import { computeLinkedReadLinesByRegion } from '../features/linkedReads/compute.ts'
import { emptyOverlapsUploadData } from '../features/overlap/types.ts'
import { getOrCreate } from '../shared/util.ts'
import { mergeSpans, overlapIntervals } from './spanOverlaps.ts'

import type {
  RefNameSpans,
  RegionBounds,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import type {
  ChainPileupData,
  LaidOutPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types'
import type { Span } from './spanOverlaps.ts'

// Total order over chains: packing distance first, then span, then chain name.
// The tiebreaks matter for the same reason `compareReadsCanonically`
// (sortLayout.ts) needs them — first-fit-lowest-row placement is arrival-order
// sensitive and JS sort is stable, so a distance-only comparator hands ties to
// whatever order the worker emitted chains in. Ties are the rule here: distance
// is `maxEnd - minStart` (or |TLEN|), so every singleton chain of a fixed-length
// read set shares one value. Across regions `mergeChains` orders by which region
// first showed a chain, so a pan that re-split the regions reshuffled the rows.
function compareChainsCanonically(
  a: { name: string; minStart: number; maxEnd: number; distance: number },
  b: { name: string; minStart: number; maxEnd: number; distance: number },
) {
  return (
    a.distance - b.distance ||
    a.minStart - b.minStart ||
    a.maxEnd - b.maxEnd ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  )
}

function buildChainRowMap(
  chains: {
    name: string
    minStart: number
    maxEnd: number
    distance: number
  }[],
  maxRows = Number.POSITIVE_INFINITY,
) {
  chains.sort(compareChainsCanonically)
  const rows: number[][] = []
  const rowMap = new Map<string, number>()
  let truncated = false
  for (const { name, minStart, maxEnd } of chains) {
    const y = placeRectCapped(rows, minStart, maxEnd, maxRows)
    rowMap.set(name, y)
    truncated = truncated || y === maxRows
  }
  return { rowMap, maxY: rows.length, truncated }
}

// One chain's merged state while `mergeChains` folds the regions into it.
// `minStart`/`maxEnd` are on the shifted placement axis and drive placement;
// `reach`/`refSeen`/`refMin`/`refMax` are unshifted genomic coordinates and
// drive the packing key alone — see the note where `distance` is resolved.
interface MergedChain {
  minStart: number
  maxEnd: number
  distance: number
  reach: number
  refSeen: string | undefined
  refMin: number
  refMax: number
}

// The chain-mode entries of one refName, so the reach fold below sees all of a
// chain's occurrences on a given chromosome consecutively. Grouping is what makes
// that fold exact rather than approximate: a view can revisit a refName
// (`chr22 … chr9 … chr22` is a real locstring — see the K562 amplicon figure), and
// ungrouped iteration would fold that refName twice, each time with a partial
// span. Few groups (one per refName in view), so this is cheap.
function chainEntriesByRefName(
  entries: [number, WorkerPileupData][],
  refNameOf: (idx: number) => string | undefined,
) {
  const byRef = new Map<string | undefined, ChainPileupData[]>()
  for (const [idx, data] of entries) {
    if (isChainData(data)) {
      getOrCreate(byRef, refNameOf(idx), () => []).push(data)
    }
  }
  return byRef
}

// Chains spanning multiple regions are merged by name. min/max give the true
// span; `distance` is a packing-order key only (`compareChainsCanonically` sorts
// it ASCENDING, so the tightest chains take the lowest rows) — placement itself
// uses the merged min/max, so the key can never cause a collision, only a worse
// ordering. It used to take the max of what each region reported, which for the
// case this layout exists to serve is every region understating it: a fusion's
// read is a singleton in each of the two regions, so a chain crossing the whole
// view carried one alignment's distance and packed among the tight ones. See
// `reach` at the end.
//
// Bounds are shifted onto their region's refName segment of the placement axis
// (`refNameAxisShift`) before merging — refNames share the genomic coordinate
// space while occupying disjoint screen space, so packing ctgA and ctgB chains
// on one axis pushed every ctgB chain below the ctgA chains covering the same
// bp. Shifting per region rather than per merged chain is what keeps an
// inter-chromosomal chain's two ends in their own segments. Identity for
// single-refName views, so the common case is untouched. `distance` is a span,
// not a coordinate, so it never shifts.
function mergeChains(
  entries: [number, WorkerPileupData][],
  regions: ReadonlyMap<number, RegionBounds> | undefined,
) {
  const refNameOf = (idx: number) => regions?.get(idx)?.refName
  const spans: RefNameSpans = new Map()
  for (const [idx, data] of entries) {
    if (isChainData(data)) {
      const { chainNames, chainAbsMinStarts, chainAbsMaxEnds } = data
      for (let i = 0; i < chainNames.length; i++) {
        extendRefNameSpan(
          spans,
          refNameOf(idx),
          chainAbsMinStarts[i]!,
          chainAbsMaxEnds[i]!,
        )
      }
    }
  }
  const shiftFor = refNameAxisShift(spans)

  const merged = new Map<string, MergedChain>()
  for (const [refName, group] of chainEntriesByRefName(entries, refNameOf)) {
    const offset = shiftFor(refName)
    for (const data of group) {
      const { chainNames, chainAbsMinStarts, chainAbsMaxEnds, chainDistances } =
        data
      for (let i = 0; i < chainNames.length; i++) {
        const name = chainNames[i]!
        const lo = chainAbsMinStarts[i]!
        const hi = chainAbsMaxEnds[i]!
        const distance = chainDistances[i]!
        const existing = merged.get(name)
        if (!existing) {
          merged.set(name, {
            minStart: lo + offset,
            maxEnd: hi + offset,
            distance,
            reach: 0,
            refSeen: refName,
            refMin: lo,
            refMax: hi,
          })
          continue
        }
        const minStart = lo + offset
        const maxEnd = hi + offset
        if (minStart < existing.minStart) {
          existing.minStart = minStart
        }
        if (maxEnd > existing.maxEnd) {
          existing.maxEnd = maxEnd
        }
        if (distance > existing.distance) {
          existing.distance = distance
        }
        if (existing.refSeen === refName) {
          if (lo < existing.refMin) {
            existing.refMin = lo
          }
          if (hi > existing.refMax) {
            existing.refMax = hi
          }
        } else {
          // Moved onto another chromosome: bank the one just finished and start
          // the next. Exact because `chainEntriesByRefName` groups the entries.
          existing.reach = Math.max(
            existing.reach,
            existing.refMax - existing.refMin,
          )
          existing.refSeen = refName
          existing.refMin = lo
          existing.refMax = hi
        }
      }
    }
  }
  // `reach` — how far the chain covers within any ONE refName, in unshifted
  // genomic coordinates — is the floor under the packing key, and the last
  // refName's span is banked here.
  //
  // A DISTANCE, NOT A COORDINATE DIFFERENCE, and that distinction is the whole
  // of this. The rule used to be `maxEnd - minStart` over the merged bounds,
  // which for two windows on one refName (collapse-introns) is exactly this
  // number and is right — but those bounds are on the PLACEMENT axis, which
  // `refNameAxisShift` builds by laying each refName end to end. So across
  // chromosomes it measured the gap between two segments of a synthetic axis, a
  // quantity with no genomic meaning that is nonetheless larger than any local
  // chain's span by construction. Every cross-region chain therefore sorted
  // behind every local one, and in a row-capped pileup an interchromosomal
  // fusion's own read support — the entire subject of the view chain mode exists
  // to serve — went below the fold.
  //
  // Two ends on two chromosomes are not a distance apart at all, so the honest
  // reading of "how far does this chain reach" is the furthest it reaches on any
  // one of them. Identity for the single-refName case, which is what the rule
  // was verified against.
  return [...merged.entries()].map(([name, b]) => ({
    name,
    minStart: b.minStart,
    maxEnd: b.maxEnd,
    distance: Math.max(b.distance, b.reach, b.refMax - b.refMin),
  }))
}

export function readYsFromRowMap(
  data: WorkerPileupData,
  rowMap: Map<string, number>,
) {
  const numReads = data.readKeys.length
  const readYs = new Uint16Array(numReads)
  if (isChainData(data)) {
    const { readChainIndices, chainNames } = data
    for (let i = 0; i < numReads; i++) {
      readYs[i] = rowMap.get(chainNames[readChainIndices[i]!]!) ?? 0
    }
  }
  return readYs
}

/**
 * Compute chain row layout for a single region. Mirrors computeLayout() from
 * sortLayout.ts but groups reads into chains by name before layout so mates
 * always share a row. Sorted by chain distance so shorter insert-size pairs
 * pack first.
 */
export function computeChainLayout(
  data: WorkerPileupData,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const chains = mergeChains([[0, data]], undefined)
  const { rowMap, maxY, truncated } = buildChainRowMap(chains, maxRows)
  return { readYs: readYsFromRowMap(data, rowMap), maxY, truncated }
}

/**
 * Compute chain layout across multiple regions, deduplicating chains that
 * span region boundaries by read name. Returns a rowMap keyed by chain name
 * for distributing rows back to each region. Mirrors computeMultiRegionLayout()
 * from sortLayout.ts, including its per-refName segmentation of the placement
 * axis (`regions`, omitted only by single-region callers/tests).
 */
export function computeMultiRegionChainLayout(
  entries: [number, WorkerPileupData][],
  regions?: ReadonlyMap<number, RegionBounds>,
  maxRows = Number.POSITIVE_INFINITY,
) {
  return buildChainRowMap(mergeChains(entries, regions), maxRows)
}

/**
 * Row count (maxY) chain layout would produce, without cloning any region.
 * Chain layout already computes maxY cheaply (no per-feature clone), so this
 * just runs the shared row-map pass and drops the clones — the count-only twin
 * of `pileupLayoutMaxY` for the fit-height pass.
 */
export function chainLayoutMaxY({
  dataMap,
  regions,
  maxRows = Number.POSITIVE_INFINITY,
}: {
  dataMap: ReadonlyMap<number, WorkerPileupData>
  regions?: ReadonlyMap<number, RegionBounds>
  maxRows?: number
}) {
  const withReads = [...dataMap].filter(([, v]) => v.readKeys.length > 0)
  return withReads.length === 0
    ? 0
    : computeMultiRegionChainLayout(withReads, regions, maxRows).maxY
}

// Chain index → the read indices belonging to that chain in this region, for the
// chains that have more than one. A single-read chain can't self-overlap, so
// counting first and grouping only the multi-read chains keeps this from
// allocating a one-element array per read — the common shape at depth, where
// most chains contribute one on-screen segment.
function groupMultiReadChains(
  readChainIndices: Uint32Array,
  numChains: number,
) {
  const counts = new Uint32Array(numChains)
  for (const chainIdx of readChainIndices) {
    counts[chainIdx]!++
  }
  const byChain = new Map<number, number[]>()
  for (let i = 0; i < readChainIndices.length; i++) {
    const chainIdx = readChainIndices[i]!
    if (counts[chainIdx]! > 1) {
      getOrCreate(byChain, chainIdx, () => []).push(i)
    }
  }
  return byChain
}

// Reads in a chain all share one row, so reads whose genomic spans overlap paint
// on top of each other and the overlap is invisible. For each chain, find the
// intervals where its reads overlap; the tint overlay (GPU + Canvas2D)
// marks them. Reads are grouped per-region because rendering is per-region; a
// chain's mates in other regions live in their own WorkerPileupData and never
// visually overlap these.
function buildChainOverlaps(data: WorkerPileupData, readYs: Uint16Array) {
  if (!isChainData(data)) {
    return emptyOverlapsUploadData()
  }
  const {
    readChainIndices,
    chainNames,
    segmentPositions,
    segmentReadIndices,
    numSegments,
  } = data

  const positions: number[] = []
  const ys: number[] = []
  const multiReadChains = groupMultiReadChains(
    readChainIndices,
    chainNames.length,
  )
  // Exon spans, not read extents: a spliced read does not cover its own
  // introns, so `readPositions` claimed an overlap across an intron the mate
  // was alone in. One pass over the segments, bucketed straight to the chain,
  // since only multi-read chains have anything to find.
  const spansByChain = new Map<number, Span[]>()
  for (let i = 0; i < numSegments; i++) {
    const chainIdx = readChainIndices[segmentReadIndices[i]!]!
    if (multiReadChains.has(chainIdx)) {
      getOrCreate(spansByChain, chainIdx, () => []).push({
        start: segmentPositions[i * 2]!,
        end: segmentPositions[i * 2 + 1]!,
      })
    }
  }
  for (const [chainIdx, spans] of spansByChain) {
    const y = readYs[multiReadChains.get(chainIdx)![0]!]!
    for (const { start, end } of mergeSpans(overlapIntervals(spans))) {
      positions.push(start, end)
      ys.push(y)
    }
  }

  return {
    overlapPositions: Uint32Array.from(positions),
    overlapYs: Uint16Array.from(ys),
  }
}

/**
 * Build chain-specific derived arrays from a read Y layout: connecting
 * lines between mates in each chain, intra-chain overlap intervals, plus a
 * Flatbush spatial index for hit testing. Returns empty-arrays/undefined when
 * the input has no chain metadata.
 *
 * Per REGION, which bounds what the line can join. `chainHasMultiple` counts a
 * chain's reads in this region alone, so a chain holding one alignment in each
 * of two displayed regions emits no line here — and could not usefully, since
 * each block clips to its own bp range and would project the far end off its
 * edge as a hairline. The SVG overlay resolves each end through its own region
 * index and draws that case instead (`bezierArcScope`, `crossRegion`).
 */
export function buildChainConnectingData(
  data: WorkerPileupData,
  readYs: Uint16Array,
) {
  if (!isChainData(data)) {
    return {
      connectingLinePositions: new Uint32Array(0),
      connectingLineYs: new Uint16Array(0),
      ...emptyOverlapsUploadData(),
      chainFlatbush: undefined as Flatbush | undefined,
    }
  }

  const {
    chainFirstReadIndices,
    chainHasMultiple,
    chainAbsMinStarts,
    chainAbsMaxEnds,
  } = data
  const numChains = chainFirstReadIndices.length

  let numLines = 0
  for (let i = 0; i < numChains; i++) {
    if (chainHasMultiple[i]) {
      numLines++
    }
  }

  const connectingLinePositions = new Uint32Array(numLines * 2)
  const connectingLineYs = new Uint16Array(numLines)
  const chainFlatbush = numChains > 0 ? new Flatbush(numChains) : undefined
  let lineIdx = 0
  for (let i = 0; i < numChains; i++) {
    const minStart = chainAbsMinStarts[i]!
    const maxEnd = chainAbsMaxEnds[i]!
    const y = readYs[chainFirstReadIndices[i]!]!
    if (chainHasMultiple[i]) {
      connectingLinePositions[lineIdx * 2] = minStart
      connectingLinePositions[lineIdx * 2 + 1] = maxEnd
      connectingLineYs[lineIdx] = y
      lineIdx++
    }
    chainFlatbush?.add(minStart, y, maxEnd, y)
  }
  chainFlatbush?.finish()

  return {
    connectingLinePositions,
    connectingLineYs,
    ...buildChainOverlaps(data, readYs),
    chainFlatbush,
  }
}

// Pileup clone + chain connecting-line / Flatbush data layered on top.
function cloneWithChainLayout(
  data: WorkerPileupData,
  readYs: Uint16Array,
  maxY: number,
  truncated: boolean,
): LaidOutPileupData {
  return {
    ...cloneWithLayout(data, readYs, maxY, truncated),
    ...buildChainConnectingData(data, readYs),
  }
}

// Layer linked-read straight-line records on top of an already-laid-out map
// (pileup or chain). The line builder needs finalized Y values and traverses by
// readName across regions to classify pairs, so this runs as a post-pass over
// the whole map. Driven by `showBezierConnections`, orthogonal to layout.
export function attachLinkedReadLines(
  laidOutMap: Map<number, LaidOutPileupData>,
): Map<number, LaidOutPileupData> {
  const linesByIdx = computeLinkedReadLinesByRegion(laidOutMap)
  if (linesByIdx.size === 0) {
    return laidOutMap
  }
  const out = new Map<number, LaidOutPileupData>()
  for (const [idx, data] of laidOutMap) {
    const lines = linesByIdx.get(idx)
    if (!lines) {
      out.set(idx, data)
      continue
    }
    out.set(idx, { ...data, ...lines })
  }
  return out
}

/**
 * Build a laid-out chain-mode pileup map from raw fetched data.
 *
 * Pass-through for entries with no reads. `computeMultiRegionChainLayout`
 * assigns a shared rowMap keyed by chain name so mates across region
 * boundaries share a row; that path is correct for one region too.
 */
export function buildLaidOutChainMap({
  dataMap,
  regions,
  maxRows = Number.POSITIVE_INFINITY,
}: {
  dataMap: ReadonlyMap<number, WorkerPileupData>
  regions?: ReadonlyMap<number, RegionBounds>
  maxRows?: number
}): Map<number, LaidOutPileupData> {
  const out = new Map<number, LaidOutPileupData>()
  const withReads: [number, WorkerPileupData][] = []
  for (const [k, v] of dataMap) {
    if (v.readKeys.length === 0) {
      out.set(k, withoutLayout(v))
    } else {
      withReads.push([k, v])
    }
  }
  if (withReads.length === 0) {
    return out
  }
  const { rowMap, maxY, truncated } = computeMultiRegionChainLayout(
    withReads,
    regions,
    maxRows,
  )
  for (const [idx, data] of withReads) {
    const readYs = readYsFromRowMap(data, rowMap)
    out.set(idx, cloneWithChainLayout(data, readYs, maxY, truncated))
  }
  return out
}
