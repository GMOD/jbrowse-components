import { INTERBASE_MASK } from '../shared/forEachMismatchTypes'

import type {
  ColorBy,
  PreBaseCoverageBin,
  PreBaseCoverageBinSubtypes,
  PreBinEntry,
} from '../shared/types'

export interface Opts {
  bpPerPx?: number
  colorBy?: ColorBy
  stopToken?: string
  /** When true, only compute depth (skip mismatch/modification processing) */
  statsEstimationMode?: boolean
}

// Uses bitwise check: converts type to bit position, then ANDs with INTERBASE_MASK
// INTERBASE_MASK = 0b110010 = (1<<1)|(1<<4)|(1<<5) for insertion, softclip, hardclip
export function mismatchLen(type: number, length: number) {
  return ((1 << type) & INTERBASE_MASK) === 0 ? length : 1
}

// Uses bitwise check: converts type to bit position, then ANDs with INTERBASE_MASK
// INTERBASE_MASK = 0b110010 = (1<<1)|(1<<4)|(1<<5) for insertion, softclip, hardclip
export function isInterbase(type: number) {
  return ((1 << type) & INTERBASE_MASK) !== 0
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

export function createEmptyBin(): PreBaseCoverageBin {
  return {
    depth: 0,
    readsCounted: 0,
    snps: {},
    ref: createPreBinEntry(),
    mods: {},
    nonmods: {},
    delskips: {},
    noncov: {},
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
