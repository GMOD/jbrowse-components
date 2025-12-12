import { TYPE_HARDCLIP, TYPE_INSERTION, TYPE_SOFTCLIP } from '../shared/types'

import type {
  ColorBy,
  Mismatch,
  PreBaseCoverageBin,
  PreBaseCoverageBinSubtypes,
  PreBinEntry,
} from '../shared/types'

export interface Opts {
  bpPerPx?: number
  colorBy?: ColorBy
  stopToken?: string
}

export function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

export function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

export function mismatchLenSOA(type: number, length: number) {
  return !isInterbaseType(type) ? length : 1
}

export function isInterbaseType(type: number) {
  return (
    type === TYPE_SOFTCLIP || type === TYPE_HARDCLIP || type === TYPE_INSERTION
  )
}

export function createPreBinEntry(): PreBinEntry {
  return {
    entryDepth: 0,
    probabilityTotal: 0,
    probabilityCount: 0,
    lengthTotal: 0,
    lengthCount: 0,
    lengthMin: Infinity,
    lengthMax: -Infinity,
    '-1': 0,
    '0': 0,
    '1': 0,
  }
}

export function inc(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  length?: number,
  sequence?: string,
) {
  const entry = (bin[type][field] ??= createPreBinEntry())
  entry.entryDepth++
  entry[strand]++
  if (length !== undefined) {
    entry.lengthTotal += length
    entry.lengthCount++
    entry.lengthMin = Math.min(entry.lengthMin, length)
    entry.lengthMax = Math.max(entry.lengthMax, length)
  }
  if (sequence !== undefined) {
    entry.sequenceCounts ??= new Map()
    entry.sequenceCounts.set(
      sequence,
      (entry.sequenceCounts.get(sequence) ?? 0) + 1,
    )
  }
}

export function incWithProbabilities(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  probability: number,
) {
  const entry = (bin[type][field] ??= createPreBinEntry())
  entry.entryDepth++
  entry.probabilityTotal += probability
  entry.probabilityCount++
  entry[strand]++
}
