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
) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      entryDepth: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.entryDepth++
  thisBin[strand]++
}

export function incWithProbabilities(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  probability: number,
) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      entryDepth: 0,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.entryDepth++
  thisBin.probabilities.push(probability)
  thisBin[strand]++
}
