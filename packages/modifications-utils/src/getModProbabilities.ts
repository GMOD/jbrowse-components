import { getTagAlt } from './getTagAlt.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * #api
 * Returns the probability value from the flat ML array for a modification's
 * position. `idx` is the position's index within the mod's stored `positions`
 * array; we recover its MM-tag order (reverse-strand reads store positions in
 * descending order) and step into ML by `probStart + mmOrder * probStride`.
 * `probStride` is >1 for combined codes (e.g. 'C+mh'), where ML values are
 * interleaved per position.
 */
export function modProbAt(
  probabilities: number[] | undefined,
  probStart: number,
  probStride: number,
  isReverse: boolean,
  idx: number,
  posLen: number,
) {
  const mmOrder = isReverse ? posLen - 1 - idx : idx
  return probabilities?.[probStart + mmOrder * probStride] ?? 0
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
    const values = typeof ml === 'string' ? ml.split(',') : ml
    return values.map(v => (+v + 0.5) / 256)
  }
  return undefined
}
