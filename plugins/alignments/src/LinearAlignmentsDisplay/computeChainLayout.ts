import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

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
  const { numReads, readChainIndices, chainNames } = data
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
 * After fillYArraysFromLayout() has populated data.readYs, build the
 * chain-specific derived arrays: connecting lines and the Flatbush spatial
 * index for hit testing.
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
    regionStart,
  } = data

  if (
    !chainFirstReadIndices ||
    !chainHasMultiple ||
    !chainAbsMinStarts ||
    !chainAbsMaxEnds
  ) {
    return
  }

  const numChains = chainFirstReadIndices.length

  // Count multi-read chains first so we can allocate exact-size arrays.
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
    connectingLinePositions[lineIdx * 2] = Math.max(
      0,
      chainAbsMinStarts[chainIdx]! - regionStart,
    )
    connectingLinePositions[lineIdx * 2 + 1] =
      chainAbsMaxEnds[chainIdx]! - regionStart
    connectingLineYs[lineIdx] = y
    lineIdx++
  }
  data.connectingLinePositions = connectingLinePositions
  data.connectingLineYs = connectingLineYs
  data.numConnectingLines = numLines

  if (numChains > 0) {
    const flatbush = new Flatbush(numChains)
    for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
      const y = readYs[chainFirstReadIndices[chainIdx]!]!
      flatbush.add(
        Math.max(0, chainAbsMinStarts[chainIdx]! - regionStart),
        y,
        chainAbsMaxEnds[chainIdx]! - regionStart,
        y,
      )
    }
    flatbush.finish()
    data.chainFlatbushData = flatbush.data
  }
}
