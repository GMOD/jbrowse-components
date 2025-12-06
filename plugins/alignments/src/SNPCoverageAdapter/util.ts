import {
  ENTRY_DEPTH,
  ENTRY_LEN_COUNT,
  ENTRY_LEN_MAX,
  ENTRY_LEN_MIN,
  ENTRY_LEN_TOTAL,
  ENTRY_NEG,
  ENTRY_POS,
  ENTRY_PROB_COUNT,
  ENTRY_PROB_TOTAL,
  MISMATCH_TYPE_INTERBASE_MASK,
} from '../shared/types'

import type { ColorBy, FlatBaseCoverageBin, Mismatch } from '../shared/types'

export interface Opts {
  bpPerPx?: number
  colorBy?: ColorBy
  stopToken?: string
}

export function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

export function isInterbase(type: number) {
  return (type & MISMATCH_TYPE_INTERBASE_MASK) !== 0
}

// Strand to entry array index: -1 -> ENTRY_NEG (1), 1 -> ENTRY_POS (2)
const STRAND_TO_ENTRY_IDX: Record<-1 | 1, number> = {
  [-1]: ENTRY_NEG,
  [1]: ENTRY_POS,
}

// Use a larger array size to accommodate length fields
const ENTRY_SIZE_WITH_LENGTH = 9

export function inc(
  bin: FlatBaseCoverageBin,
  strand: -1 | 0 | 1,
  key: string,
  length?: number,
) {
  let entry = bin.entries.get(key)
  if (!entry) {
    entry = new Uint32Array(length !== undefined ? ENTRY_SIZE_WITH_LENGTH : 3)
    if (length !== undefined) {
      // Initialize min to max uint32 value so first comparison works
      entry[ENTRY_LEN_MIN] = 0xffffffff
      entry[ENTRY_LEN_MAX] = 0
    }
    bin.entries.set(key, entry)
  }
  entry[ENTRY_DEPTH]!++
  if (strand !== 0) {
    entry[STRAND_TO_ENTRY_IDX[strand]]!++
  }
  if (length !== undefined) {
    entry[ENTRY_LEN_TOTAL]! += length
    entry[ENTRY_LEN_COUNT]!++
    if (length < entry[ENTRY_LEN_MIN]!) {
      entry[ENTRY_LEN_MIN] = length
    }
    if (length > entry[ENTRY_LEN_MAX]!) {
      entry[ENTRY_LEN_MAX] = length
    }
  }
}

export function incWithProbabilities(
  bin: FlatBaseCoverageBin,
  strand: -1 | 0 | 1,
  key: string,
  probability: number,
) {
  let entry = bin.entries.get(key)
  if (!entry) {
    entry = new Uint32Array(5)
    bin.entries.set(key, entry)
  }
  entry[ENTRY_DEPTH]!++
  if (strand !== 0) {
    entry[STRAND_TO_ENTRY_IDX[strand]]!++
  }
  entry[ENTRY_PROB_TOTAL]! += Math.round(probability * 1000000)
  entry[ENTRY_PROB_COUNT]!++
}

// Helper to get average probability from entry (returns 0-1 range)
export function getAvgProbability(entry: Uint32Array) {
  const count = entry[ENTRY_PROB_COUNT] || 0
  return count ? (entry[ENTRY_PROB_TOTAL] || 0) / count / 1000000 : 0
}

// Helper to get length stats from entry
export function getLengthStats(entry: Uint32Array) {
  const count = entry[ENTRY_LEN_COUNT] || 0
  if (!count) {
    return undefined
  }
  return {
    avgLength: (entry[ENTRY_LEN_TOTAL] || 0) / count,
    minLength: entry[ENTRY_LEN_MIN],
    maxLength: entry[ENTRY_LEN_MAX],
  }
}
