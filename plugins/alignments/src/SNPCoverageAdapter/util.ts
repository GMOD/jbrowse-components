import {
  ENTRY_DEPTH,
  ENTRY_NEG,
  ENTRY_POS,
  ENTRY_PROB_COUNT,
  ENTRY_PROB_TOTAL,
  ENTRY_ZERO,
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

// Strand to entry array index: -1 -> ENTRY_NEG (1), 0 -> ENTRY_ZERO (2), 1 -> ENTRY_POS (3)
const STRAND_TO_ENTRY_IDX: Record<-1 | 0 | 1, number> = {
  [-1]: ENTRY_NEG,
  [0]: ENTRY_ZERO,
  [1]: ENTRY_POS,
}

export function inc(
  bin: FlatBaseCoverageBin,
  strand: -1 | 0 | 1,
  key: string,
) {
  const strandIdx = STRAND_TO_ENTRY_IDX[strand]
  let entry = bin.entries.get(key)
  if (!entry) {
    entry = new Uint32Array(4)
    bin.entries.set(key, entry)
  }
  ;(entry[ENTRY_DEPTH] as number)++
  ;(entry[strandIdx] as number)++
}

export function incWithProbabilities(
  bin: FlatBaseCoverageBin,
  strand: -1 | 0 | 1,
  key: string,
  probability: number,
) {
  const strandIdx = STRAND_TO_ENTRY_IDX[strand]
  let entry = bin.entries.get(key)
  if (!entry) {
    entry = new Uint32Array(6)
    bin.entries.set(key, entry)
  }
  ;(entry[ENTRY_DEPTH] as number)++
  ;(entry[strandIdx] as number)++
  ;(entry[ENTRY_PROB_TOTAL] as number) += Math.round(probability * 1000000)
  ;(entry[ENTRY_PROB_COUNT] as number)++
}

// Helper to get average probability from entry (returns 0-1 range)
export function getAvgProbability(entry: Uint32Array) {
  const count = entry[ENTRY_PROB_COUNT]
  return count ? entry[ENTRY_PROB_TOTAL]! / count / 1000000 : 0
}
