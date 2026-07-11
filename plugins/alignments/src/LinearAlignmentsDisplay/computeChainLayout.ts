import Flatbush from '@jbrowse/core/util/flatbush'

import {
  cloneWithLayout,
  placeRectCapped,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import { isChainData } from '../RenderAlignmentDataRPC/types.ts'
import { computeLinkedReadLinesByRegion } from '../features/linkedReads/compute.ts'
import { emptyOverlapsUploadData } from '../features/overlap/types.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types'

function buildChainRowMap(
  chains: {
    name: string
    minStart: number
    maxEnd: number
    distance: number
  }[],
  maxRows = Number.POSITIVE_INFINITY,
) {
  chains.sort((a, b) => a.distance - b.distance)
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

// Chains spanning multiple regions are merged by name. min/max give the
// true span; max-distance is the longest end-to-end view, which keeps the
// largest chains packing first under placeRect's distance-sort.
function mergeChains(datasets: PileupDataResult[]) {
  const merged = new Map<
    string,
    { minStart: number; maxEnd: number; distance: number }
  >()
  for (const data of datasets) {
    if (!isChainData(data)) {
      continue
    }
    const { chainNames, chainAbsMinStarts, chainAbsMaxEnds, chainDistances } =
      data
    for (let i = 0; i < chainNames.length; i++) {
      const name = chainNames[i]!
      const minStart = chainAbsMinStarts[i]!
      const maxEnd = chainAbsMaxEnds[i]!
      const distance = chainDistances[i]!
      const existing = merged.get(name)
      if (!existing) {
        merged.set(name, { minStart, maxEnd, distance })
      } else {
        if (minStart < existing.minStart) {
          existing.minStart = minStart
        }
        if (maxEnd > existing.maxEnd) {
          existing.maxEnd = maxEnd
        }
        if (distance > existing.distance) {
          existing.distance = distance
        }
      }
    }
  }
  return [...merged.entries()].map(([name, bounds]) => ({ name, ...bounds }))
}

export function readYsFromRowMap(
  data: PileupDataResult,
  rowMap: Map<string, number>,
) {
  const numReads = data.readIds.length
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
  data: PileupDataResult,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const chains = mergeChains([data])
  const { rowMap, maxY, truncated } = buildChainRowMap(chains, maxRows)
  return { readYs: readYsFromRowMap(data, rowMap), maxY, truncated }
}

/**
 * Compute chain layout across multiple regions, deduplicating chains that
 * span region boundaries by read name. Returns a rowMap keyed by chain name
 * for distributing rows back to each region. Mirrors computeMultiRegionLayout()
 * from sortLayout.ts.
 */
export function computeMultiRegionChainLayout(
  entries: [number, PileupDataResult][],
  maxRows = Number.POSITIVE_INFINITY,
) {
  const chains = mergeChains(entries.map(([, d]) => d))
  return buildChainRowMap(chains, maxRows)
}

/**
 * Row count (maxY) chain layout would produce, without cloning any region.
 * Chain layout already computes maxY cheaply (no per-feature clone), so this
 * just runs the shared row-map pass and drops the clones — the count-only twin
 * of `pileupLayoutMaxY` for the fit-height pass.
 */
export function chainLayoutMaxY(
  dataMap: ReadonlyMap<number, PileupDataResult>,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const withReads = [...dataMap].filter(([, v]) => v.readIds.length > 0)
  return withReads.length === 0
    ? 0
    : computeMultiRegionChainLayout(withReads, maxRows).maxY
}

export interface Span {
  start: number
  end: number
}

// Genomic intervals where spans on one shared row overlap. Sweeps spans in
// start order tracking the running max end; each span beginning before that end
// contributes its intersection with the already-covered region. Pure and
// position-only, so it's unit-testable independent of PileupDataResult.
export function overlapIntervals(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out: Span[] = []
  let runningMaxEnd = sorted[0]?.end ?? 0
  for (let i = 1; i < sorted.length; i++) {
    const { start, end } = sorted[i]!
    const overlapEnd = Math.min(end, runningMaxEnd)
    if (start < overlapEnd) {
      out.push({ start, end: overlapEnd })
    }
    runningMaxEnd = Math.max(runningMaxEnd, end)
  }
  return out
}

// Collapse a set of spans into their disjoint union, merging any that overlap or
// touch. overlapIntervals can emit several intervals that themselves overlap
// (3+ reads in one chain), and the tint overlay alpha-blends — without merging,
// multiply-covered spans would blend twice and render as darker patches. Union
// gives one uniform tint over "where reads overlap".
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out: Span[] = []
  for (const span of sorted) {
    const last = out[out.length - 1]
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
    } else {
      out.push({ ...span })
    }
  }
  return out
}

// Map of chain index → the read indices belonging to that chain in this region.
function groupReadsByChain(readChainIndices: Uint32Array) {
  const byChain = new Map<number, number[]>()
  for (let i = 0; i < readChainIndices.length; i++) {
    const c = readChainIndices[i]!
    const list = byChain.get(c)
    if (list) {
      list.push(i)
    } else {
      byChain.set(c, [i])
    }
  }
  return byChain
}

// Reads in a chain all share one row, so reads whose genomic spans overlap paint
// on top of each other and the overlap is invisible. For each chain, find the
// intervals where its reads overlap; the tint overlay (GPU + Canvas2D)
// marks them. Reads are grouped per-region because rendering is per-region; a
// chain's mates in other regions live in their own PileupDataResult and never
// visually overlap these.
function buildChainOverlaps(data: PileupDataResult, readYs: Uint16Array) {
  if (!isChainData(data)) {
    return emptyOverlapsUploadData()
  }
  const { readChainIndices, readPositions } = data

  const positions: number[] = []
  const ys: number[] = []
  for (const reads of groupReadsByChain(readChainIndices).values()) {
    const spans = reads.map(ri => ({
      start: readPositions[ri * 2]!,
      end: readPositions[ri * 2 + 1]!,
    }))
    const y = readYs[reads[0]!]!
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
 */
export function buildChainConnectingData(
  data: PileupDataResult,
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
  data: PileupDataResult,
  readYs: Uint16Array,
  maxY: number,
  truncated: boolean,
): PileupDataResult {
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
  laidOutMap: Map<number, PileupDataResult>,
): Map<number, PileupDataResult> {
  const linesByIdx = computeLinkedReadLinesByRegion(laidOutMap)
  if (linesByIdx.size === 0) {
    return laidOutMap
  }
  const out = new Map<number, PileupDataResult>()
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
export function buildLaidOutChainMap(
  dataMap: ReadonlyMap<number, PileupDataResult>,
  maxRows = Number.POSITIVE_INFINITY,
): Map<number, PileupDataResult> {
  const out = new Map<number, PileupDataResult>()
  const withReads: [number, PileupDataResult][] = []
  for (const [k, v] of dataMap) {
    if (v.readIds.length === 0) {
      out.set(k, v)
    } else {
      withReads.push([k, v])
    }
  }
  if (withReads.length === 0) {
    return out
  }
  const { rowMap, maxY, truncated } = computeMultiRegionChainLayout(
    withReads,
    maxRows,
  )
  for (const [idx, data] of withReads) {
    const readYs = readYsFromRowMap(data, rowMap)
    out.set(idx, cloneWithChainLayout(data, readYs, maxY, truncated))
  }
  return out
}
