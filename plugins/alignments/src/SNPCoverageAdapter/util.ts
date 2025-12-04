import type {
  ColorBy,
  Mismatch,
  PreBaseCoverageBin,
  PreBaseCoverageBinSubtypes,
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

export function inc(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  length?: number,
) {
  const entry = (bin[type][field] ??= {
    entryDepth: 0,
    probabilities: [],
    lengthTotal: 0,
    lengthCount: 0,
    lengthMin: Infinity,
    lengthMax: -Infinity,
    '-1': 0,
    '0': 0,
    '1': 0,
  })
  entry.entryDepth++
  entry[strand]++
  if (length !== undefined) {
    entry.lengthTotal += length
    entry.lengthCount++
    entry.lengthMin = Math.min(entry.lengthMin, length)
    entry.lengthMax = Math.max(entry.lengthMax, length)
  }
}

export function incWithProbabilities(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  probability: number,
) {
  const entry = (bin[type][field] ??= {
    entryDepth: 0,
    probabilities: [],
    lengthTotal: 0,
    lengthCount: 0,
    lengthMin: Infinity,
    lengthMax: -Infinity,
    '-1': 0,
    '0': 0,
    '1': 0,
  })
  entry.entryDepth++
  entry.probabilities.push(probability)
  entry[strand]++
}
