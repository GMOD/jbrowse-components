import {
  ENTRY_DEPTH,
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

export function inc(bin: FlatBaseCoverageBin, strand: -1 | 0 | 1, key: string) {
  let entry = bin.entries.get(key)
  if (!entry) {
    entry = new Uint32Array(3)
    bin.entries.set(key, entry)
  }
  entry[ENTRY_DEPTH] = (entry[ENTRY_DEPTH] || 0) + 1
  if (strand !== 0) {
    const strandIdx = STRAND_TO_ENTRY_IDX[strand]
    entry[strandIdx] = (entry[strandIdx] || 0) + 1
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
  entry[ENTRY_DEPTH] = (entry[ENTRY_DEPTH] || 0) + 1
  if (strand !== 0) {
    const strandIdx = STRAND_TO_ENTRY_IDX[strand]
    entry[strandIdx] = (entry[strandIdx] || 0) + 1
  }
  entry[ENTRY_PROB_TOTAL] =
    (entry[ENTRY_PROB_TOTAL] || 0) + Math.round(probability * 1000000)
  entry[ENTRY_PROB_COUNT] = (entry[ENTRY_PROB_COUNT] || 0) + 1
}

// Helper to get average probability from entry (returns 0-1 range)
export function getAvgProbability(entry: Uint32Array) {
  const count = entry[ENTRY_PROB_COUNT] || 0
  return count ? (entry[ENTRY_PROB_TOTAL] || 0) / count / 1000000 : 0
}
