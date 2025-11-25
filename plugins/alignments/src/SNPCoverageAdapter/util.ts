import { MISMATCH_TYPE_INTERBASE_MASK } from '../shared/types'

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

export function isInterbase(type: number) {
  return (type & MISMATCH_TYPE_INTERBASE_MASK) !== 0
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
      probabilityTotal: probability,
      probabilityCount: 1,
      '-1': 0,
      '0': 0,
      '1': 0,
    }
    thisBin[strand] = 1
  } else {
    thisBin.entryDepth++
    thisBin.probabilityTotal = (thisBin.probabilityTotal || 0) + probability
    thisBin.probabilityCount = (thisBin.probabilityCount || 0) + 1
    thisBin[strand]++
  }
}
