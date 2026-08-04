/**
 * Swap two slots. Pulled out so the partition below reads as the algorithm
 * rather than as six index expressions.
 */
function swap(a: Float32Array, i: number, j: number) {
  const t = a[i]!
  a[i] = a[j]!
  a[j] = t
}

/**
 * The `k`th smallest of `a[0, n)`, permuting `a` in place — quickselect.
 *
 * This exists because the color scale needs exactly two order statistics, and a
 * full sort to get them is wildly disproportionate: sorting 4.5M counts
 * measured ~1.0s against ~30ms for a linear scan. Selection is O(n) expected,
 * so it lands within a small multiple of that scan while returning the *exact*
 * value a sort would have.
 *
 * Exact matters more than it looks. A histogram estimate is the obvious cheaper
 * answer and it is wrong for this data: contact counts are heavily skewed (a
 * handful of very hot bins, a long tail near zero), so linear buckets over
 * `[min, max]` drop nearly every value into bucket 0 and collapse the 95th
 * percentile toward zero — which is the one number the color ramp saturates
 * against.
 *
 * Median-of-three pivoting is not decoration either. Contacts arrive in bin
 * order and counts correlate with distance from the diagonal, so the input is
 * substantially pre-sorted — precisely the shape that degrades a
 * first-element pivot to O(n²).
 */
function selectNth(a: Float32Array, n: number, k: number) {
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    // order lo <= mid <= hi, which both picks the pivot and places two of the
    // three values on the side they already belong
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

    // Hoare partition: on exit everything in [lo, j] is <= pivot, everything in
    // [i, hi] is >= pivot, and anything strictly between them equals it
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
      // k fell in the all-equal middle, so a[k] is already the answer
      return a[k]!
    }
  }
  return a[k]!
}

/**
 * Color-scale saturation candidates: the maximum and the 95th percentile of
 * `counts`, both scored off its **finite** subset.
 *
 * Filtering non-finites is not tidiness. NaN is the `.hic` dense-block "no
 * value" marker and a tiny normalization divisor yields Infinity, and both
 * propagate: `Math.max(colorMaxScore, …)` in the shader and in `mapHicCount`
 * turns a single NaN into a NaN color for *every* bin, and the legend silently
 * disappears (`hasLegendData` reads `NaN > 0`). Scoring off the finite subset
 * keeps the damage to the offending bin. Both returned values are 0 when
 * nothing is finite.
 *
 * The compaction is written as an explicit loop rather than
 * `counts.filter(Number.isFinite)`, and that is the larger half of the win:
 * `TypedArray.prototype.filter` with a callback measured ~1.6s on 4.5M values
 * against ~60ms for this loop. It also doubles as the copy selection needs (it
 * permutes its input) and as the max scan, so the whole statistic is one linear
 * pass plus the selection — 1809ms to 127ms at 4.5M contacts.
 *
 * Measure changes here outside Jest. Under its Babel transform `Number.isFinite`
 * does not get inlined and reads ~14x slower than it does in a plain V8 run,
 * which is enough to point at the wrong bottleneck entirely.
 */
export function computeCountStats(counts: Float32Array, numContacts: number) {
  const finite = new Float32Array(numContacts)
  let n = 0
  let maxScore = 0
  for (let i = 0; i < numContacts; i++) {
    const c = counts[i]!
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
