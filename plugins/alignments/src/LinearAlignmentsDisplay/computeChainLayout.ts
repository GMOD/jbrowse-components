import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

import { cloneWithLayout } from '../RenderPileupDataRPC/sortLayout.ts'
import { computeLinkedReadLinesByRegion } from '../features/linkedReads/compute.ts'

import type { PileupDataResult } from '../RenderPileupDataRPC/types'

function buildChainRowMap(
  chains: {
    name: string
    minStart: number
    maxEnd: number
    distance: number
  }[],
) {
  chains.sort((a, b) => a.distance - b.distance)
  const rows: number[][] = []
  const rowMap = new Map<string, number>()
  for (const { name, minStart, maxEnd } of chains) {
    rowMap.set(name, placeRect(rows, minStart, maxEnd))
  }
  return { rowMap, maxY: rows.length }
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
    const { chainNames, chainAbsMinStarts, chainAbsMaxEnds, chainDistances } =
      data
    if (
      !chainNames ||
      !chainAbsMinStarts ||
      !chainAbsMaxEnds ||
      !chainDistances
    ) {
      continue
    }
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
  const { readChainIndices, chainNames } = data
  const numReads = data.readIds.length
  const readYs = new Uint16Array(numReads)
  if (readChainIndices && chainNames) {
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
export function computeChainLayout(data: PileupDataResult) {
  const chains = mergeChains([data])
  const { rowMap, maxY } = buildChainRowMap(chains)
  return { readYs: readYsFromRowMap(data, rowMap), maxY }
}

/**
 * Compute chain layout across multiple regions, deduplicating chains that
 * span region boundaries by read name. Returns a rowMap keyed by chain name
 * for distributing rows back to each region. Mirrors computeMultiRegionLayout()
 * from sortLayout.ts.
 */
export function computeMultiRegionChainLayout(
  entries: [number, PileupDataResult][],
) {
  const chains = mergeChains(entries.map(([, d]) => d))
  return buildChainRowMap(chains)
}

/**
 * Build chain-specific derived arrays from a read Y layout: connecting
 * lines between mates in each chain plus a Flatbush spatial index for
 * hit testing. Returns empty-arrays/undefined when the input has no
 * chain metadata.
 */
export function buildChainConnectingData(
  data: PileupDataResult,
  readYs: Uint16Array,
) {
  const {
    chainFirstReadIndices,
    chainHasMultiple,
    chainAbsMinStarts,
    chainAbsMaxEnds,
  } = data

  if (
    !chainFirstReadIndices ||
    !chainHasMultiple ||
    !chainAbsMinStarts ||
    !chainAbsMaxEnds
  ) {
    return {
      connectingLinePositions: new Uint32Array(0),
      connectingLineYs: new Uint16Array(0),
      chainFlatbush: undefined as Flatbush | undefined,
    }
  }

  const numChains = chainFirstReadIndices.length

  let numLines = 0
  for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
    if (chainHasMultiple[chainIdx]) {
      numLines++
    }
  }

  const connectingLinePositions = new Uint32Array(numLines * 2)
  const connectingLineYs = new Uint16Array(numLines)
  let lineIdx = 0
  for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
    if (!chainHasMultiple[chainIdx]) {
      continue
    }
    const y = readYs[chainFirstReadIndices[chainIdx]!]!
    connectingLinePositions[lineIdx * 2] = chainAbsMinStarts[chainIdx]!
    connectingLinePositions[lineIdx * 2 + 1] = chainAbsMaxEnds[chainIdx]!
    connectingLineYs[lineIdx] = y
    lineIdx++
  }

  let chainFlatbush: Flatbush | undefined
  if (numChains > 0) {
    chainFlatbush = new Flatbush(numChains)
    for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
      const y = readYs[chainFirstReadIndices[chainIdx]!]!
      chainFlatbush.add(
        chainAbsMinStarts[chainIdx]!,
        y,
        chainAbsMaxEnds[chainIdx],
        y,
      )
    }
    chainFlatbush.finish()
  }

  return {
    connectingLinePositions,
    connectingLineYs,
    chainFlatbush,
  }
}

// Pileup clone + chain connecting-line / Flatbush data layered on top.
function cloneWithChainLayout(
  data: PileupDataResult,
  readYs: Uint16Array,
  maxY: number,
): PileupDataResult {
  return {
    ...cloneWithLayout(data, readYs, maxY),
    ...buildChainConnectingData(data, readYs),
  }
}

// Layer linked-read straight-line records on top of an already chain-laid-out
// map. The line builder needs Y values to be finalized (which they are once
// `cloneWithChainLayout` has run) and traverses by readName across regions to
// classify pairs, so this runs as a post-pass over the whole map.
function attachLinkedReadLines(
  laidOutMap: Map<number, PileupDataResult>,
): Map<number, PileupDataResult> {
  const linesByIdx = computeLinkedReadLinesByRegion({
    laidOutPileupMap: laidOutMap,
  })
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
    out.set(idx, {
      ...data,
      linkedReadLinePositions: lines.positions,
      linkedReadLineYs: lines.ys,
      linkedReadLineColorTypes: lines.colorTypes,
      numLinkedReadLines: lines.numLines,
    })
  }
  return out
}

/**
 * Build a laid-out chain-mode pileup map from raw fetched data.
 *
 * Pass-through for entries with no reads. For a single region the layout
 * uses `computeChainLayout`; for multiple regions `computeMultiRegionChainLayout`
 * assigns a shared rowMap keyed by chain name so mates across region
 * boundaries share a row.
 */
export function buildLaidOutChainMap(
  dataMap: ReadonlyMap<number, PileupDataResult>,
  renderingMode: string,
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
  if (withReads.length === 1) {
    const [idx, data] = withReads[0]!
    const { readYs, maxY } = computeChainLayout(data)
    out.set(idx, cloneWithChainLayout(data, readYs, maxY))
  } else {
    const { rowMap, maxY } = computeMultiRegionChainLayout(withReads)
    for (const [idx, data] of withReads) {
      const readYs = readYsFromRowMap(data, rowMap)
      out.set(idx, cloneWithChainLayout(data, readYs, maxY))
    }
  }
  return renderingMode === 'linkedReadBezier' ? attachLinkedReadLines(out) : out
}
