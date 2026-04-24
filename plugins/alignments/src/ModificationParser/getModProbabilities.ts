import { getTagAlt } from '../util.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * Returns the probability value from the flat probabilities array at the
 * correct offset for a given modification position, handling the reverse-strand
 * index reversal that getModPositions applies (positions stored in descending
 * order for reverse-strand reads).
 */
export function modProbAt(
  probabilities: number[] | undefined,
  probIndex: number,
  isReverse: boolean,
  idx: number,
  posLen: number,
) {
  return (
    probabilities?.[probIndex + (isReverse ? posLen - 1 - idx : idx)] ?? 0
  )
}

export function getModProbabilities(feature: Feature) {
  // ML stores probabilities as array of numerics and MP is scaled phred scores
  // https://github.com/samtools/hts-specs/pull/418/files#diff-e765c6479316309f56b636f88189cdde8c40b854c7bdcce9ee7fe87a4e76febcR596
  //
  // - if we have ML or Ml, it is an 8bit probability, divide by 255
  //
  // - if we have MP or Mp it is phred scaled ASCII, which can go up to 90 but
  // has very high likelihood basecalls at that point, we really only care about
  // low qual calls <20 approx
  const ml = getTagAlt(feature, 'ML', 'Ml') as number[] | string | undefined
  if (ml !== undefined) {
    if (typeof ml === 'string') {
      return ml.split(',').map(v => +v / 255)
    }
    return ml.map(v => v / 255)
  }
  const mp = getTagAlt(feature, 'MP', 'Mp') as string | undefined
  if (mp) {
    return Array.from(mp, c => Math.min(1, (c.charCodeAt(0) - 33) / 50))
  }
  return undefined
}
