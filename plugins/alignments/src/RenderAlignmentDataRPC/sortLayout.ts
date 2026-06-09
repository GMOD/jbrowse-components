import Flatbush from '@jbrowse/core/util/flatbush'
import { placeRect } from '@jbrowse/core/util/layouts/placeRect'

import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'

import type { PileupDataResult } from './types'
import type { SortedBy } from '../shared/types.ts'

const DELETION_CHAR = 42 // '*'

function sortByMapWithUnknownsLast(
  arr: number[],
  map: Map<number, number>,
  desc: boolean,
) {
  arr.sort((a, b) => {
    const aVal = map.get(a) ?? 0
    const bVal = map.get(b) ?? 0
    if (aVal !== 0 && bVal === 0) {
      return -1
    }
    if (aVal === 0 && bVal !== 0) {
      return 1
    }
    return desc ? bVal - aVal : aVal - bVal
  })
}

function buildSoftclipExpansions(data: PileupDataResult) {
  const expansions = new Map<number, { start: number; end: number }>()
  for (let i = 0; i < data.interbasePositions.length; i++) {
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
  } = data
  const numMismatches = mismatchPositions.length
  const numGaps = gapPositions.length / 2
  const numInterbases = interbasePositions.length

  if (type === 'basePair') {
    const baseAtPos = new Map<number, number>()
    for (let i = 0; i < numMismatches; i++) {
      if (mismatchPositions[i] === sortPos) {
        baseAtPos.set(mismatchReadIndices[i]!, mismatchBases[i]!)
      }
    }
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
    sortByMapWithUnknownsLast(overlapping, baseAtPos, false)
  } else if (['insertion', 'softclip', 'hardclip'].includes(type)) {
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
    sortByMapWithUnknownsLast(overlapping, lengthAtPos, true)
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

// Place a rect but never let the layout grow past `maxRows` rows. When
// placeRect opens a row beyond the cap (it has no limit by design) we pop that
// overflow row back off and return the `maxRows` sentinel, which renders flush
// against the content bottom (just out of view) so capped reads don't expand
// the pileup. Callers treat a `maxRows` result as truncation. A bare number
// rather than a {y, overflow} pair so the per-read hot loop allocates nothing.
//
// `maxRows` is bounded ≤ 65534 by the caller so the sentinel and every real row
// index fit the Uint16Array — at >65535x coverage the raw count would wrap.
function placeRectCapped(
  rows: number[][],
  start: number,
  end: number,
  maxRows: number,
) {
  const y = placeRect(rows, start, end)
  const overflow = y >= maxRows
  if (overflow) {
    rows.pop()
  }
  return overflow ? maxRows : y
}

/**
 * Compute pileup row layout for a single region. Returns
 * readYs[i] = pileup row for read i, maxY = total row count, and `truncated`
 * when `maxRows` clipped the stack.
 */
export function computeLayout(
  data: PileupDataResult,
  showSoftClipping?: boolean,
  maxRows = Number.POSITIVE_INFINITY,
) {
  const numReads = data.readIds.length
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const readYs = new Uint16Array(numReads)
  const rows: number[][] = []
  let truncated = false

  // When soft-clipping is on, sort by layout left edge (which includes soft-clip
  // expansion) instead of genomic position. The placeRect algorithm requires
  // left-to-right ordering for row hints to work correctly.
  if (showSoftClipping) {
    const readIndices: number[] = []
    for (let i = 0; i < numReads; i++) {
      readIndices.push(i)
    }
    readIndices.sort((a, b) => {
      const aStart = readExtent(data, a, expansions).start
      const bStart = readExtent(data, b, expansions).start
      // Tiebreaker: genomic start position
      return aStart !== bStart
        ? aStart - bStart
        : (data.readPositions[a * 2] ?? 0) - (data.readPositions[b * 2] ?? 0)
    })
    for (const i of readIndices) {
      const { start, end } = readExtent(data, i, expansions)
      const y = placeRectCapped(rows, start, end, maxRows)
      readYs[i] = y
      truncated = truncated || y === maxRows
    }
  } else {
    for (let i = 0; i < numReads; i++) {
      const { start, end } = readExtent(data, i, expansions)
      const y = placeRectCapped(rows, start, end, maxRows)
      readYs[i] = y
      truncated = truncated || y === maxRows
    }
  }

  return { readYs, maxY: rows.length, truncated }
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
  maxRows = Number.POSITIVE_INFINITY,
) {
  const { readPositions } = data
  const numReads = data.readIds.length
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
  let truncated = false
  for (const i of overlapping) {
    const { start, end } = readExtent(data, i, expansions)
    const y = placeRectCapped(rows, start, end, maxRows)
    readYs[i] = y
    truncated = truncated || y === maxRows
  }
  for (const i of nonOverlapping) {
    const { start, end } = readExtent(data, i, expansions)
    const y = placeRectCapped(rows, start, end, maxRows)
    readYs[i] = y
    truncated = truncated || y === maxRows
  }
  return { readYs, maxY: rows.length, truncated }
}

/**
 * Compute layout across multiple regions, deduplicating reads that span
 * region boundaries by featureId. Returns rowMap<featureId, row> for
 * distributing rows back to each region's readYs array.
 */
export function computeMultiRegionLayout(
  entries: [number, PileupDataResult][],
  maxRows = Number.POSITIVE_INFINITY,
) {
  const seen = new Set<string>()
  const reads: { id: string; start: number; end: number }[] = []
  for (const [, data] of entries) {
    for (let i = 0; i < data.readIds.length; i++) {
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
  let truncated = false
  for (const { id, start, end } of reads) {
    const y = placeRectCapped(rows, start, end, maxRows)
    rowMap.set(id, y)
    truncated = truncated || y === maxRows
  }
  return { rowMap, maxY: rows.length, truncated }
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
  truncated = false,
): PileupDataResult {
  const numGaps = data.gapPositions.length / 2
  const numMismatches = data.mismatchPositions.length
  const numInterbases = data.interbasePositions.length
  const numModifications = data.modificationPositions.length
  const numSoftclipBases = data.softclipBasePositions.length
  const numPerBaseQual = data.perBaseQualPositions.length
  const numPerBaseLetter = data.perBaseLetterPositions.length
  const gapYs = new Uint16Array(numGaps)
  const mismatchYs = new Uint16Array(numMismatches)
  const interbaseYs = new Uint16Array(numInterbases)
  const modificationYs = new Uint16Array(numModifications)
  const softclipBaseYs = new Uint16Array(numSoftclipBases)
  const perBaseQualYs = new Uint16Array(numPerBaseQual)
  const perBaseLetterYs = new Uint16Array(numPerBaseLetter)
  for (let i = 0; i < numGaps; i++) {
    gapYs[i] = readYs[data.gapReadIndices[i]!]!
  }
  for (let i = 0; i < numMismatches; i++) {
    mismatchYs[i] = readYs[data.mismatchReadIndices[i]!]!
  }
  for (let i = 0; i < numInterbases; i++) {
    interbaseYs[i] = readYs[data.interbaseReadIndices[i]!]!
  }
  for (let i = 0; i < numModifications; i++) {
    modificationYs[i] = readYs[data.modificationReadIndices[i]!]!
  }
  for (let i = 0; i < numSoftclipBases; i++) {
    softclipBaseYs[i] = readYs[data.softclipBaseReadIndices[i]!]!
  }
  for (let i = 0; i < numPerBaseQual; i++) {
    perBaseQualYs[i] = readYs[data.perBaseQualReadIndices[i]!]!
  }
  for (let i = 0; i < numPerBaseLetter; i++) {
    perBaseLetterYs[i] = readYs[data.perBaseLetterReadIndices[i]!]!
  }
  let modFlatbush: Flatbush | undefined
  if (numModifications > 0) {
    modFlatbush = new Flatbush(numModifications)
    for (let i = 0; i < numModifications; i++) {
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
    perBaseQualYs,
    perBaseLetterYs,
    maxY,
    truncated,
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
  maxRows = Number.POSITIVE_INFINITY,
}: {
  dataMap: ReadonlyMap<number, PileupDataResult>
  sortedBy: SortedBy | undefined
  showSoftClipping: boolean | undefined
  maxRows?: number
}): Map<number, PileupDataResult> {
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
    const { readYs, maxY, truncated } = sortedBy
      ? computeSortedLayout(data, sortedBy, showSoftClipping, maxRows)
      : computeLayout(data, showSoftClipping, maxRows)
    out.set(idx, cloneWithLayout(data, readYs, maxY, truncated))
  } else {
    const { rowMap, maxY, truncated } = computeMultiRegionLayout(
      withReads,
      maxRows,
    )
    for (const [idx, data] of withReads) {
      const numReads = data.readIds.length
      const readYs = new Uint16Array(numReads)
      for (let i = 0; i < numReads; i++) {
        readYs[i] = rowMap.get(data.readIds[i]!)!
      }
      out.set(idx, cloneWithLayout(data, readYs, maxY, truncated))
    }
  }
  return out
}
