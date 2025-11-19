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
  const typeObj = bin[type]
  let thisBin = typeObj[field]
  if (!thisBin) {
    thisBin = typeObj[field] = {
      entryDepth: 1,
      probabilities: [],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
    thisBin[strand] = 1
  } else {
    thisBin.entryDepth++
    thisBin[strand]++
  }
}

export function incWithProbabilities(
  bin: PreBaseCoverageBin,
  strand: -1 | 0 | 1,
  type: keyof PreBaseCoverageBinSubtypes,
  field: string,
  probability: number,
) {
  const typeObj = bin[type]
  let thisBin = typeObj[field]
  if (!thisBin) {
    thisBin = typeObj[field] = {
      entryDepth: 1,
      probabilities: [probability],
      '-1': 0,
      '0': 0,
      '1': 0,
    }
    thisBin[strand] = 1
  } else {
    thisBin.entryDepth++
    thisBin.probabilities.push(probability)
    thisBin[strand]++
  }
}
