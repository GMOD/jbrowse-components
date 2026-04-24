import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'

import type { PileupDataResult } from './types'
import type { SortedBy } from '../shared/types.ts'

// ASCII code for '*' used to represent deletions in base pair sort
const DELETION_CHAR = 42

/**
 * Build softclip expansions per read index from the interbase typed arrays.
 * Returns a Map<readIndex, {start, end}> representing the expanded genomic
 * extent of each read's soft-clipped bases, or undefined if none.
 */
function buildSoftclipExpansions(data: PileupDataResult) {
  if (!data.interbaseReadIndices) {
    return undefined
  }
  const expansions = new Map<number, { start: number; end: number }>()
  for (let i = 0; i < data.numInterbases; i++) {
    if (data.interbaseTypes[i] !== INTERBASE_SOFTCLIP) {
      continue
    }
    const readIdx = data.interbaseReadIndices[i]!
    const pos = data.interbasePositions[i]!
    const len = data.interbaseLengths[i]!
    const readStart = data.readPositions[readIdx * 2]!
    const clipStart = pos === readStart ? pos - len : pos
    const clipEnd = clipStart + len
    const existing = expansions.get(readIdx)
    if (!existing) {
      expansions.set(readIdx, { start: clipStart, end: clipEnd })
    } else {
      if (clipStart < existing.start) {
        existing.start = clipStart
      }
      if (clipEnd > existing.end) {
        existing.end = clipEnd
      }
    }
  }
  return expansions.size > 0 ? expansions : undefined
}

/**
 * Get a read's effective [start,end) including any softclip expansion.
 */
function readExtent(
  data: PileupDataResult,
  i: number,
  expansions: Map<number, { start: number; end: number }> | undefined,
) {
  const start = data.readPositions[i * 2]!
  const end = data.readPositions[i * 2 + 1]!
  const exp = expansions?.get(i)
  return {
    start: exp ? Math.min(start, exp.start) : start,
    end: exp ? Math.max(end, exp.end) : end,
  }
}

function sortOverlappingByIndex(
  overlapping: number[],
  data: PileupDataResult,
  sortedBy: SortedBy,
  sortTagValues: string[] | undefined,
) {
  const { type, pos: sortPos } = sortedBy
  const {
    readPositions,
    readStrands,
    mismatchReadIndices,
    mismatchPositions,
    mismatchBases,
    gapReadIndices,
    gapPositions,
    gapTypes,
    interbaseReadIndices,
    interbasePositions,
    interbaseLengths,
    interbaseTypes,
    numMismatches,
    numGaps,
    numInterbases,
  } = data

  if (type === 'basePair') {
    const baseAtPos = new Map<number, number>()
    if (mismatchReadIndices) {
      for (let i = 0; i < numMismatches; i++) {
        if (mismatchPositions[i] === sortPos) {
          baseAtPos.set(mismatchReadIndices[i]!, mismatchBases[i]!)
        }
      }
    }
    if (gapReadIndices) {
      for (let i = 0; i < numGaps; i++) {
        if (gapTypes[i] !== 0) {
          continue
        }
        const gapStart = gapPositions[i * 2]!
        const gapEnd = gapPositions[i * 2 + 1]!
        if (gapStart <= sortPos && gapEnd > sortPos) {
          const readIdx = gapReadIndices[i]!
          if (!baseAtPos.has(readIdx)) {
            baseAtPos.set(readIdx, DELETION_CHAR)
          }
        }
      }
    }
    overlapping.sort((a, b) => {
      const aBase = baseAtPos.get(a) ?? 0
      const bBase = baseAtPos.get(b) ?? 0
      if (aBase !== 0 && bBase === 0) {
        return -1
      }
      if (aBase === 0 && bBase !== 0) {
        return 1
      }
      return aBase - bBase
    })
  } else if (
    type === 'insertion' ||
    type === 'softclip' ||
    type === 'hardclip'
  ) {
    if (interbaseReadIndices) {
      const targetType =
        type === 'insertion'
          ? INTERBASE_INSERTION
          : type === 'softclip'
            ? INTERBASE_SOFTCLIP
            : INTERBASE_HARDCLIP
      const lengthAtPos = new Map<number, number>()
      for (let i = 0; i < numInterbases; i++) {
        if (interbaseTypes[i] !== targetType) {
          continue
        }
        if (interbasePositions[i] === sortPos) {
          const readIdx = interbaseReadIndices[i]!
          const len = interbaseLengths[i]!
          const existing = lengthAtPos.get(readIdx) ?? 0
          if (len > existing) {
            lengthAtPos.set(readIdx, len)
          }
        }
      }
      overlapping.sort((a, b) => {
        const aLen = lengthAtPos.get(a) ?? 0
        const bLen = lengthAtPos.get(b) ?? 0
        if (aLen !== 0 && bLen === 0) {
          return -1
        }
        if (aLen === 0 && bLen !== 0) {
          return 1
        }
        return bLen - aLen
      })
    }
  } else if (type === 'position') {
    overlapping.sort((a, b) => readPositions[a * 2]! - readPositions[b * 2]!)
  } else if (type === 'strand') {
    overlapping.sort((a, b) => readStrands[b]! - readStrands[a]!)
  } else if (type === 'tag' && sortTagValues) {
    const first = overlapping[0]
    const firstVal = first !== undefined ? sortTagValues[first] : undefined
    const isString = firstVal !== undefined && Number.isNaN(Number(firstVal))
    if (isString) {
      overlapping.sort((a, b) =>
        (sortTagValues[b] ?? '').localeCompare(sortTagValues[a] ?? ''),
      )
    } else {
      overlapping.sort(
        (a, b) => Number(sortTagValues[b] ?? 0) - Number(sortTagValues[a] ?? 0),
      )
    }
  }
}

/**
 * Compute pileup row layout for a single region. Returns
 * readYs[i] = pileup row for read i, and maxY = total row count.
 */
export function computeLayout(
  data: PileupDataResult,
  showSoftClipping?: boolean,
) {
  const { numReads } = data
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const readYs = new Uint16Array(numReads)
  const rows: number[][] = []
  for (let i = 0; i < numReads; i++) {
    const { start, end } = readExtent(data, i, expansions)
    readYs[i] = placeRect(rows, start, end)
  }
  return { readYs, maxY: rows.length }
}

/**
 * Compute pileup row layout with a custom sort at `sortedBy.pos`. Reads
 * overlapping the sort position are placed first in sort-criterion
 * order (each gets its own row since they all collide pairwise at
 * sortPos), then non-overlapping reads fill gaps around them.
 */
export function computeSortedLayout(
  data: PileupDataResult,
  sortedBy: SortedBy,
  showSoftClipping?: boolean,
) {
  const { numReads, readPositions } = data
  const { pos: sortPos } = sortedBy
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const overlapping: number[] = []
  const nonOverlapping: number[] = []
  for (let i = 0; i < numReads; i++) {
    const start = readPositions[i * 2]!
    const end = readPositions[i * 2 + 1]!
    if (start <= sortPos && end > sortPos) {
      overlapping.push(i)
    } else {
      nonOverlapping.push(i)
    }
  }

  sortOverlappingByIndex(overlapping, data, sortedBy, data.sortTagValues)

  const readYs = new Uint16Array(numReads)
  const rows: number[][] = []
  for (const i of overlapping) {
    const { start, end } = readExtent(data, i, expansions)
    readYs[i] = placeRect(rows, start, end)
  }
  for (const i of nonOverlapping) {
    const { start, end } = readExtent(data, i, expansions)
    readYs[i] = placeRect(rows, start, end)
  }
  return { readYs, maxY: rows.length }
}

/**
 * Compute layout across multiple regions, deduplicating reads that span
 * region boundaries by featureId. Returns rowMap<featureId, row> for
 * distributing rows back to each region's readYs array.
 */
export function computeMultiRegionLayout(
  entries: [number, PileupDataResult][],
) {
  const seen = new Set<string>()
  const reads: { id: string; start: number; end: number }[] = []
  for (const [, data] of entries) {
    for (let i = 0; i < data.numReads; i++) {
      const id = data.readIds[i]!
      if (!seen.has(id)) {
        seen.add(id)
        reads.push({
          id,
          start: data.readPositions[i * 2]!,
          end: data.readPositions[i * 2 + 1]!,
        })
      }
    }
  }

  const rowMap = new Map<string, number>()
  const rows: number[][] = []
  for (const { id, start, end } of reads) {
    rowMap.set(id, placeRect(rows, start, end))
  }
  return { rowMap, maxY: rows.length }
}

/**
 * Shallow clone of a PileupDataResult with freshly-computed Y arrays
 * propagated from a per-read readYs. All other typed arrays are shared.
 *
 * Exported so chain-mode layout can reuse the same Y propagation.
 */
export function cloneWithLayout(
  data: PileupDataResult,
  readYs: Uint16Array,
  maxY: number,
): PileupDataResult {
  const gapYs = new Uint16Array(data.numGaps)
  const mismatchYs = new Uint16Array(data.numMismatches)
  const interbaseYs = new Uint16Array(data.numInterbases)
  const modificationYs = new Uint16Array(data.numModifications)
  const softclipBaseYs = new Uint16Array(data.numSoftclipBases)
  if (data.gapReadIndices) {
    const src = data.gapReadIndices
    for (let i = 0; i < data.numGaps; i++) {
      gapYs[i] = readYs[src[i]!]!
    }
  }
  if (data.mismatchReadIndices) {
    const src = data.mismatchReadIndices
    for (let i = 0; i < data.numMismatches; i++) {
      mismatchYs[i] = readYs[src[i]!]!
    }
  }
  if (data.interbaseReadIndices) {
    const src = data.interbaseReadIndices
    for (let i = 0; i < data.numInterbases; i++) {
      interbaseYs[i] = readYs[src[i]!]!
    }
  }
  if (data.modificationReadIndices) {
    const src = data.modificationReadIndices
    for (let i = 0; i < data.numModifications; i++) {
      modificationYs[i] = readYs[src[i]!]!
    }
  }
  if (data.softclipBaseReadIndices) {
    const src = data.softclipBaseReadIndices
    for (let i = 0; i < data.numSoftclipBases; i++) {
      softclipBaseYs[i] = readYs[src[i]!]!
    }
  }
  let modFlatbush: Flatbush | undefined
  if (data.numModifications > 0) {
    modFlatbush = new Flatbush(data.numModifications)
    for (let i = 0; i < data.numModifications; i++) {
      const pos = data.modificationPositions[i]!
      const row = modificationYs[i]!
      modFlatbush.add(pos, row, pos, row)
    }
    modFlatbush.finish()
  }

  return {
    ...data,
    readYs,
    gapYs,
    mismatchYs,
    interbaseYs,
    modificationYs,
    softclipBaseYs,
    maxY,
    modFlatbush,
  }
}

/**
 * Build a laid-out pileup map from raw fetched data. The raw map's entries
 * keep zero-filled Y arrays (from the worker); this returns a parallel map
 * whose entries have Y arrays and maxY derived from pileup layout.
 *
 * Intended to be called from a MobX-cached getter so layout recomputes only
 * when `rpcDataMap`, `sortedBy`, or `showSoftClipping` change.
 */
export function buildLaidOutPileupMap({
  dataMap,
  sortedBy,
  showSoftClipping,
}: {
  dataMap: ReadonlyMap<number, PileupDataResult>
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean | undefined
}): Map<number, PileupDataResult> {
  const out = new Map<number, PileupDataResult>()
  const withReads: [number, PileupDataResult][] = []
  for (const [k, v] of dataMap) {
    if (v.numReads === 0) {
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
    const { readYs, maxY } = sortedBy
      ? computeSortedLayout(data, sortedBy, showSoftClipping)
      : computeLayout(data, showSoftClipping)
    out.set(idx, cloneWithLayout(data, readYs, maxY))
  } else {
    const { rowMap, maxY } = computeMultiRegionLayout(withReads)
    for (const [idx, data] of withReads) {
      const readYs = new Uint16Array(data.numReads)
      for (let i = 0; i < data.numReads; i++) {
        readYs[i] = rowMap.get(data.readIds[i]!) ?? 0
      }
      out.set(idx, cloneWithLayout(data, readYs, maxY))
    }
  }
  return out
}
