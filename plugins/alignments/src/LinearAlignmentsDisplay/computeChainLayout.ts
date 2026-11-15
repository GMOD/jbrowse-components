import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import Flatbush from '@jbrowse/core/util/flatbush'

import {
  cloneWithLayout,
  placeRectCapped,
  withoutLayout,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import { UNCAPPED, isChainData } from '../RenderAlignmentDataRPC/types.ts'
import { screenOrderOf } from '../features/linkedReads/computeOverlay.ts'
import { emptyOverlapsUploadData } from '../features/overlap/types.ts'
import {
  OVERLAP_MATES,
  OVERLAP_SEGMENTS,
} from '../shaders/slang/overlap.consts.generated.ts'
import { getOrCreate } from '../shared/util.ts'
import { mergeSortedSpans, subtractSortedSpans } from './spanOverlaps.ts'

import type { RegionBounds } from '../RenderAlignmentDataRPC/sortLayout.ts'
import type {
  ChainPileupData,
  ChainedPileupData,
  LaidOutPileupData,
  RowCap,
  RowCapSource,
} from '../RenderAlignmentDataRPC/types'
import type { OverlapsUploadData } from '../features/overlap/types.ts'
import type { Span } from './spanOverlaps.ts'

interface ReadSpan extends Span {
  read: number
}

const byStart = (a: Span, b: Span) => a.start - b.start

// Total order over chains: one in several displayed regions first, since a row
// cap drops from the end and those chains are what joins the regions; then
// packing distance, then span, then chain name.
// The tiebreaks matter for the same reason `compareReadsCanonically`
// (sortLayout.ts) needs them — first-fit-lowest-row placement is arrival-order
// sensitive and JS sort is stable, so a distance-only comparator hands ties to
// whatever order chains were numbered in. Ties are the rule here: distance
// is `maxEnd - minStart` (or |TLEN|), so every singleton chain of a fixed-length
// read set shares one value. Across regions `mergeChains` orders by which region
// first showed a chain, so a pan that re-split the regions reshuffled the rows.
interface PackedChain {
  name: string
  minStart: number
  maxEnd: number
  distance: number
  crossesRegions: boolean
}

function compareChainsCanonically(a: PackedChain, b: PackedChain) {
  return (
    Number(b.crossesRegions) - Number(a.crossesRegions) ||
    a.distance - b.distance ||
    a.minStart - b.minStart ||
    a.maxEnd - b.maxEnd ||
    (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  )
}

function buildChainRowMap(
  chains: PackedChain[],
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
// `minStart`/`maxEnd` are on the screen-order placement axis and drive
// placement; `reach`/`refSeen`/`refMin`/`refMax` are genomic coordinates and
// drive the packing key alone — see the note where `distance` is resolved.
interface MergedChain {
  minStart: number
  maxEnd: number
  distance: number
  crossesRegions: boolean
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
  entries: [number, ChainedPileupData][],
  refNameOf: (idx: number) => string | undefined,
) {
  const byRef = new Map<string | undefined, [number, ChainPileupData][]>()
  for (const [idx, data] of entries) {
    if (isChainData(data)) {
      getOrCreate(byRef, refNameOf(idx), () => []).push([idx, data])
    }
  }
  return byRef
}

// Negated for a whole-view flip, so its rows mirror the unflipped view's.
function placementAxis(
  entries: [number, ChainedPileupData][],
  regions: ReadonlyMap<number, RegionBounds> | undefined,
) {
  const reversedOf = (idx: number) => regions?.get(idx)?.reversed
  const sign =
    entries.length > 0 && entries.every(([idx]) => reversedOf(idx) === true)
      ? -1
      : 1
  return (idx: number, bp: number) =>
    sign * screenOrderOf(reversedOf(idx), idx, bp)
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
function mergeChains(
  entries: [number, ChainedPileupData][],
  regions: ReadonlyMap<number, RegionBounds> | undefined,
) {
  const refNameOf = (idx: number) => regions?.get(idx)?.refName
  const axis = placementAxis(entries, regions)
  const merged = new Map<string, MergedChain>()
  for (const [refName, group] of chainEntriesByRefName(entries, refNameOf)) {
    for (const [idx, data] of group) {
      const { chainNames, chainAbsMinStarts, chainAbsMaxEnds, chainDistances } =
        data
      for (let i = 0; i < chainNames.length; i++) {
        const name = chainNames[i]!
        const lo = chainAbsMinStarts[i]!
        const hi = chainAbsMaxEnds[i]!
        const distance = chainDistances[i]!
        const a = axis(idx, lo)
        const b = axis(idx, hi)
        const minStart = Math.min(a, b)
        const maxEnd = Math.max(a, b)
        const existing = merged.get(name)
        if (!existing) {
          merged.set(name, {
            minStart,
            maxEnd,
            distance,
            crossesRegions: false,
            reach: 0,
            refSeen: refName,
            refMin: lo,
            refMax: hi,
          })
          continue
        }
        existing.crossesRegions = true
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
  // `reach` — how far the chain covers within any ONE refName, in genomic
  // coordinates — is the floor under the packing key, and the last refName's
  // span is banked here. It is a distance, not a difference of placement-axis
  // coordinates, which lay regions a fixed stride apart and so measure nothing
  // genomic: charged that, every cross-region chain sorted behind every local
  // one, and a row-capped fusion view lost its own read support below the
  // fold. Two ends on two chromosomes are not a distance apart at all, so the
  // chain reaches the furthest it reaches on any one of them.
  return [...merged.entries()].map(([name, b]) => ({
    name,
    minStart: b.minStart,
    maxEnd: b.maxEnd,
    distance: Math.max(b.distance, b.reach, b.refMax - b.refMin),
    crossesRegions: b.crossesRegions,
  }))
}

export function readYsFromRowMap(
  data: ChainedPileupData,
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
 * Compute chain layout across multiple regions, deduplicating chains that
 * span region boundaries by read name. Returns a rowMap keyed by chain name
 * for distributing rows back to each region. Unlike computeMultiRegionLayout()
 * in sortLayout.ts, which packs on the genomic axis segmented per refName, it
 * packs on the screen order of the displayed regions (`regions`, omitted only
 * by single-region callers/tests), since a chain's connector runs across them.
 */
export function computeMultiRegionChainLayout(
  entries: [number, ChainedPileupData][],
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
  dataMap: ReadonlyMap<number, ChainedPileupData>
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
// intervals where its reads overlap, and of which kind; the overlap mark
// (GPU + Canvas2D) fills them. Reads are grouped per-region because rendering
// is per-region; a chain's mates in other regions live in their own region's
// data and never visually overlap these.
function buildChainOverlaps(
  data: ChainPileupData,
  readYs: Uint16Array,
  multiReadChains: Map<number, number[]>,
) {
  const {
    readChainIndices,
    readFlags,
    segmentPositions,
    segmentReadIndices,
    numSegments,
  } = data

  const positions: number[] = []
  const ys: number[] = []
  const kinds: number[] = []
  const emit = (spans: Span[], y: number, kind: number) => {
    for (const { start, end } of spans) {
      positions.push(start, end)
      ys.push(y)
      kinds.push(kind)
    }
  }
  // Exon spans, not read extents: a spliced read does not cover its own
  // introns, so `readPositions` claimed an overlap across an intron the mate
  // was alone in. One pass over the segments, bucketed straight to the chain,
  // since only multi-read chains have anything to find.
  const spansByChain = new Map<number, ReadSpan[]>()
  for (let i = 0; i < numSegments; i++) {
    const read = segmentReadIndices[i]!
    const chainIdx = readChainIndices[read]!
    if (multiReadChains.has(chainIdx)) {
      getOrCreate(spansByChain, chainIdx, () => []).push({
        read,
        start: segmentPositions[i * 2]!,
        end: segmentPositions[i * 2 + 1]!,
      })
    }
  }
  for (const [chainIdx, spans] of spansByChain) {
    const y = readYs[multiReadChains.get(chainIdx)![0]!]!
    const { segments, mates } = chainOverlapsByKind(spans, readFlags)
    emit(segments, y, OVERLAP_SEGMENTS)
    emit(mates, y, OVERLAP_MATES)
  }

  return {
    overlapPositions: Uint32Array.from(positions),
    overlapYs: Uint16Array.from(ys),
    overlapKinds: Uint8Array.from(kinds),
  }
}

const NOT_PRIMARY = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY
const MATE_ENDS = SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SECOND_IN_PAIR

function areOverlappingMates(flagsA: number, flagsB: number) {
  return (
    (flagsA & flagsB & SAM_FLAG_PAIRED) !== 0 &&
    ((flagsA | flagsB) & NOT_PRIMARY) === 0 &&
    ((flagsA ^ flagsB) & MATE_ENDS) !== 0
  )
}

/**
 * Where one chain's segments of DIFFERENT reads overlap, split by what the two
 * reads are: the two primary mates of a pair, or anything with a split or
 * supplementary segment in it. Each kind merged; where both apply the span is
 * a segment overlap, so the two lists are disjoint.
 */
function chainOverlapsByKind(spans: ReadSpan[], readFlags: ArrayLike<number>) {
  const sorted = spans.toSorted((a, b) => a.start - b.start)
  const segments: Span[] = []
  const mates: Span[] = []
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!
    for (let j = i + 1; j < sorted.length && sorted[j]!.start < a.end; j++) {
      const b = sorted[j]!
      if (a.read !== b.read) {
        const span = { start: b.start, end: Math.min(a.end, b.end) }
        if (areOverlappingMates(readFlags[a.read]!, readFlags[b.read]!)) {
          mates.push(span)
        } else {
          segments.push(span)
        }
      }
    }
  }
  const mergedSegments = mergeSortedSpans(segments.sort(byStart))
  return {
    segments: mergedSegments,
    mates: subtractSortedSpans(
      mergeSortedSpans(mates.sort(byStart)),
      mergedSegments,
    ),
  }
}

interface ChainOverlapsAndIndex extends OverlapsUploadData {
  chainFlatbush: Flatbush | undefined
}

function emptyChainOverlapsAndIndex(): ChainOverlapsAndIndex {
  return {
    ...emptyOverlapsUploadData(),
    chainFlatbush: undefined,
  }
}

/**
 * A chain region's intra-chain overlap intervals and the Flatbush index of
 * each chain's span on its row, for hit testing. Empty when the input has no
 * chain metadata. The pileup connectors join a chain's reads.
 */
export function buildChainOverlapsAndIndex(
  data: ChainedPileupData,
  readYs: Uint16Array,
) {
  if (!isChainData(data)) {
    return emptyChainOverlapsAndIndex()
  }

  const {
    readChainIndices,
    chainFirstReadIndices,
    chainAbsMinStarts,
    chainAbsMaxEnds,
  } = data
  const numChains = chainFirstReadIndices.length
  const multiReadChains = groupMultiReadChains(readChainIndices, numChains)
  const chainFlatbush = numChains > 0 ? new Flatbush(numChains) : undefined
  for (let i = 0; i < numChains; i++) {
    const minStart = chainAbsMinStarts[i]!
    const maxEnd = chainAbsMaxEnds[i]!
    const y = readYs[chainFirstReadIndices[i]!]!
    chainFlatbush?.add(minStart, y, maxEnd, y)
  }
  chainFlatbush?.finish()

  return {
    ...buildChainOverlaps(data, readYs, multiReadChains),
    chainFlatbush,
  }
}

// Pileup clone + chain overlap / Flatbush data layered on top.
function cloneWithChainLayout(
  data: ChainedPileupData,
  readYs: Uint16Array,
  maxY: number,
  clippedBy: RowCapSource | undefined,
): LaidOutPileupData {
  return {
    ...cloneWithLayout(data, readYs, maxY, clippedBy),
    ...buildChainOverlapsAndIndex(data, readYs),
  }
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
  rowCap = UNCAPPED,
}: {
  dataMap: ReadonlyMap<number, ChainedPileupData>
  regions?: ReadonlyMap<number, RegionBounds>
  // The cap and the policy that set it — see `PileupLayoutArgs.rowCap`.
  rowCap?: RowCap
}): Map<number, LaidOutPileupData> {
  const out = new Map<number, LaidOutPileupData>()
  const withReads: [number, ChainedPileupData][] = []
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
    rowCap.rows,
  )
  const clippedBy = truncated ? rowCap.source : undefined
  for (const [idx, data] of withReads) {
    const readYs = readYsFromRowMap(data, rowMap)
    out.set(idx, cloneWithChainLayout(data, readYs, maxY, clippedBy))
  }
  return out
}
