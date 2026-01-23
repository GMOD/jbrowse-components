import { complementBase } from './constants.ts'

import type {
  ModificationCountsParams,
  ModificationCountsResult,
} from './types.ts'

export function calculateModificationCounts({
  base,
  isSimplex,
  refbase,
  snps,
  ref,
  score0,
}: ModificationCountsParams): ModificationCountsResult {
  if (base === 'N') {
    return { modifiable: score0, detectable: score0 }
  }

  const cmp = complementBase[base as keyof typeof complementBase]

  const baseCount =
    (snps[base]?.entryDepth || 0) + (refbase === base ? ref.entryDepth : 0)
  const complCount =
    (snps[cmp]?.entryDepth || 0) + (refbase === cmp ? ref.entryDepth : 0)

  const modifiable = baseCount + complCount

  const detectable = isSimplex
    ? (snps[base]?.['1'] || 0) +
      (snps[cmp]?.['-1'] || 0) +
      (refbase === base ? ref['1'] : 0) +
      (refbase === cmp ? ref['-1'] : 0)
    : modifiable

  return { modifiable, detectable }
}
