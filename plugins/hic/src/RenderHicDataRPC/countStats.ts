import {
  MIN_DOMAIN_QUANTILE,
  quantileOf,
} from '@jbrowse/core/util/quantileExtent'

import { getInstanceCount } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'

/**
 * The minimum, the maximum and the nearest-rank `quantile` of the finite
 * counts. An Infinity, from a tiny normalization divisor, would otherwise
 * become the color domain and paint every bin wrong. All are 0 when nothing
 * is finite.
 *
 * An explicit loop, not `filter(Number.isFinite)`, which measured ~25x
 * slower at 4.5M; measure outside Jest, whose transform does not inline
 * `Number.isFinite`.
 */
export function computeCountStats(
  instances: Float32Array,
  numContacts: number,
  quantile: number,
) {
  const finite = new Float32Array(numContacts)
  let n = 0
  let minScore = 0
  let maxScore = 0
  for (let i = 0; i < numContacts; i++) {
    const c = getInstanceCount(instances, i)
    if (Number.isFinite(c)) {
      if (n === 0 || c < minScore) {
        minScore = c
      }
      if (n === 0 || c > maxScore) {
        maxScore = c
      }
      finite[n] = c
      n++
    }
  }
  return n === 0
    ? { minScore: 0, maxScore: 0, quantileScore: 0 }
    : {
        minScore,
        maxScore,
        quantileScore: quantileOf(
          finite,
          n,
          Math.max(MIN_DOMAIN_QUANTILE, quantile),
        ),
      }
}
