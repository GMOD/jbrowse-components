import { selectNth } from '@jbrowse/core/util/rampExtent'

import { getInstanceCount } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'

/**
 * The maximum and `quantile` percentile of the finite counts. A NaN (the
 * `.hic` no-value marker) or an Infinity (a tiny normalization divisor) would
 * otherwise become the colour domain and paint every bin wrong. Both are 0
 * when nothing is finite.
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
  let maxScore = 0
  for (let i = 0; i < numContacts; i++) {
    const c = getInstanceCount(instances, i)
    if (Number.isFinite(c)) {
      if (n === 0 || c > maxScore) {
        maxScore = c
      }
      finite[n] = c
      n++
    }
  }
  return n === 0
    ? { maxScore: 0, quantileScore: 0 }
    : {
        maxScore,
        quantileScore: selectNth(
          finite,
          n,
          Math.min(n - 1, Math.max(0, Math.floor(quantile * (n - 1)))),
        ),
      }
}
