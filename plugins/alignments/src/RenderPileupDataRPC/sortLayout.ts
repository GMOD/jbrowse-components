import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types'

import type { PileupDataResult } from './types'
import type { SortedBy } from '../shared/types'

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
    const ibPosOffset = data.interbasePositions[i]!
    const len = data.interbaseLengths[i]!
    const pos = data.regionStart + ibPosOffset
    const readStartOffset = data.readPositions[readIdx * 2]!
    const clipStart = ibPosOffset === readStartOffset ? pos - len : pos
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

function sortOverlappingByIndex(
  overlapping: number[],
  data: PileupDataResult,
  sortedBy: SortedBy,
  sortTagValues: string[] | undefined,
) {
  const { type, pos: sortPos } = sortedBy
  const {
    regionStart,
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
        if (regionStart + mismatchPositions[i]! === sortPos) {
          baseAtPos.set(mismatchReadIndices[i]!, mismatchBases[i]!)
        }
      }
    }
    if (gapReadIndices) {
      for (let i = 0; i < numGaps; i++) {
        if (gapTypes[i] !== 0) {
          continue
        }
        const gapStart = regionStart + gapPositions[i * 2]!
        const gapEnd = regionStart + gapPositions[i * 2 + 1]!
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
        if (regionStart + interbasePositions[i]! === sortPos) {
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
 * Compute pileup row layout for a single region, working directly on the
 * typed arrays in PileupDataResult. Uses read index as the layout key,
 * avoiding string-keyed Map operations.
 *
 * Returns readYs[i] = pileup row for read i, and maxY = total row count.
 */
export function computeLayout(
  data: PileupDataResult,
  showSoftClipping?: boolean,
) {
  const { numReads, readPositions, regionStart } = data
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const sortedIndices = Array.from({ length: numReads }, (_, i) => i)
  sortedIndices.sort((a, b) => {
    const aStart = regionStart + readPositions[a * 2]!
    const bStart = regionStart + readPositions[b * 2]!
    const aExp = expansions?.get(a)
    const bExp = expansions?.get(b)
    return (
      (aExp ? Math.min(aStart, aExp.start) : aStart) -
      (bExp ? Math.min(bStart, bExp.start) : bStart)
    )
  })

  const readYs = new Uint16Array(numReads)
  const levels: number[] = []
  let maxY = 0

  for (const i of sortedIndices) {
    const start = regionStart + readPositions[i * 2]!
    const end = regionStart + readPositions[i * 2 + 1]!
    const exp = expansions?.get(i)
    const effectiveStart = exp ? Math.min(start, exp.start) : start
    const effectiveEnd = exp ? Math.max(end, exp.end) : end

    let y = levels.length
    for (let j = 0; j < levels.length; j++) {
      if (levels[j]! <= effectiveStart) {
        y = j
        break
      }
    }
    readYs[i] = y
    levels[y] = effectiveEnd + 2
    if (y > maxY) {
      maxY = y
    }
  }

  return { readYs, maxY: numReads > 0 ? maxY + 1 : 0 }
}

/**
 * Compute sorted pileup row layout for a single region. Reads overlapping
 * the sort position are sorted by the given criteria and packed first;
 * non-overlapping reads fill remaining rows.
 *
 * Returns readYs[i] = pileup row for read i, and maxY = total row count.
 */
export function computeSortedLayout(
  data: PileupDataResult,
  sortedBy: SortedBy,
  showSoftClipping?: boolean,
) {
  const { numReads, readPositions, regionStart } = data
  const { pos: sortPos } = sortedBy
  const expansions = showSoftClipping
    ? buildSoftclipExpansions(data)
    : undefined

  const overlapping: number[] = []
  const nonOverlapping: number[] = []
  for (let i = 0; i < numReads; i++) {
    const start = regionStart + readPositions[i * 2]!
    const end = regionStart + readPositions[i * 2 + 1]!
    if (start <= sortPos && end > sortPos) {
      overlapping.push(i)
    } else {
      nonOverlapping.push(i)
    }
  }

  sortOverlappingByIndex(overlapping, data, sortedBy, data.sortTagValues)

  const readYs = new Uint16Array(numReads)
  const levels: number[] = []
  let maxY = 0
  let nextRow = 0

  for (const i of overlapping) {
    const start = regionStart + readPositions[i * 2]!
    const end = regionStart + readPositions[i * 2 + 1]!
    const exp = expansions?.get(i)
    const effectiveStart = exp ? Math.min(start, exp.start) : start
    const effectiveEnd = exp ? Math.max(end, exp.end) : end

    let y = Math.max(levels.length, nextRow)
    for (let j = nextRow; j < levels.length; j++) {
      if ((levels[j] ?? 0) <= effectiveStart) {
        y = j
        break
      }
    }
    readYs[i] = y
    levels[y] = effectiveEnd + 2
    nextRow = y + 1
    if (y > maxY) {
      maxY = y
    }
  }

  for (const i of nonOverlapping) {
    const start = regionStart + readPositions[i * 2]!
    const end = regionStart + readPositions[i * 2 + 1]!
    const exp = expansions?.get(i)
    const effectiveStart = exp ? Math.min(start, exp.start) : start
    const effectiveEnd = exp ? Math.max(end, exp.end) : end

    let y = levels.length
    for (let j = 0; j < levels.length; j++) {
      if ((levels[j] ?? 0) <= effectiveStart) {
        y = j
        break
      }
    }
    readYs[i] = y
    levels[y] = effectiveEnd + 2
    if (y > maxY) {
      maxY = y
    }
  }

  return { readYs, maxY: numReads > 0 ? maxY + 1 : 0 }
}

/**
 * Compute layout across multiple regions, deduplicating reads that span
 * region boundaries by featureId. Returns a Map<featureId, row> for
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
          start: data.regionStart + data.readPositions[i * 2]!,
          end: data.regionStart + data.readPositions[i * 2 + 1]!,
        })
      }
    }
  }

  reads.sort((a, b) => a.start - b.start)

  const rowMap = new Map<string, number>()
  const levels: number[] = []

  for (const { id, start, end } of reads) {
    let y = levels.length
    for (let i = 0; i < levels.length; i++) {
      if (levels[i]! <= start) {
        y = i
        break
      }
    }
    rowMap.set(id, y)
    levels[y] = end + 2
  }

  return { rowMap, maxY: levels.length }
}
