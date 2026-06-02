import { getTagAlt } from './getTagAlt.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * #api
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
  return probabilities?.[probIndex + (isReverse ? posLen - 1 - idx : idx)] ?? 0
}

/**
 * #api
 * Reads the ML tag from a feature and returns per-call modification
 * probabilities scaled to 0..1.
 */
export function getModProbabilities(feature: Feature) {
  // ML is an 8-bit scaled probability. Per SAMtags, integer N covers the
  // continuous range N/256..(N+1)/256, so the representative value is the
  // midpoint (N + 0.5) / 256.
  const ml = getTagAlt(feature, 'ML', 'Ml') as number[] | string | undefined
  if (ml !== undefined) {
    if (typeof ml === 'string') {
      return ml.split(',').map(v => (+v + 0.5) / 256)
    }
    return ml.map(v => (v + 0.5) / 256)
  }
  return undefined
}
