import { getInstanceCount } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'

function swap(a: Float32Array, i: number, j: number) {
  const t = a[i]!
  a[i] = a[j]!
  a[j] = t
}

/**
 * The `k`th smallest of `a[0, n)`, permuting `a` in place. Exact, where a
 * histogram collapses skewed contact counts into its bottom bucket, and O(n)
 * where a sort of 4.5M counts measured ~1s. Median-of-three because contacts
 * arrive nearly sorted.
 */
function selectNth(a: Float32Array, n: number, k: number) {
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (a[mid]! < a[lo]!) {
      swap(a, mid, lo)
    }
    if (a[hi]! < a[lo]!) {
      swap(a, hi, lo)
    }
    if (a[hi]! < a[mid]!) {
      swap(a, hi, mid)
    }
    const pivot = a[mid]!

    let i = lo
    let j = hi
    while (i <= j) {
      while (a[i]! < pivot) {
        i++
      }
      while (a[j]! > pivot) {
        j--
      }
      if (i <= j) {
        swap(a, i, j)
        i++
        j--
      }
    }

    if (k <= j) {
      hi = j
    } else if (k >= i) {
      lo = i
    } else {
      return a[k]!
    }
  }
  return a[k]!
}

/**
 * The maximum and 95th percentile of the finite counts. A NaN (the `.hic`
 * no-value marker) or an Infinity (a tiny normalization divisor) would
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
    ? { maxScore: 0, percentile95: 0 }
    : {
        maxScore,
        percentile95: selectNth(finite, n, Math.floor(0.95 * (n - 1))),
      }
}
