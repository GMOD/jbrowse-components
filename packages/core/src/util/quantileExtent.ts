/** The quantile "Clip outliers" clips at on a scale whose own default is the extremes. */
export const DEFAULT_CLIP_QUANTILE = 0.99

/**
 * #api
 * The quantile a clip toggle writes: a scale's declared default where that
 * clips, below 1, else {@link DEFAULT_CLIP_QUANTILE}.
 */
export function clipQuantileOf(declaredDefault: unknown) {
  return typeof declaredDefault === 'number' && declaredDefault < 1
    ? declaredDefault
    : DEFAULT_CLIP_QUANTILE
}

function swap(a: Float32Array, i: number, j: number) {
  const t = a[i]!
  a[i] = a[j]!
  a[j] = t
}

/**
 * #api
 * The `k`th smallest of `a[0, n)`, permuting `a` in place. Exact, where a
 * histogram collapses skewed contact counts into its bottom bucket, and O(n)
 * where a sort of 4.5M counts measured ~1s. Median-of-three because Hi-C
 * contacts arrive nearly sorted.
 */
export function selectNth(a: Float32Array, n: number, k: number) {
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
 * #api
 * The least and greatest finite values of `values[0, count)`,
 * `[Infinity, -Infinity]` where none is finite.
 */
export function finiteExtremes(
  values: ArrayLike<number>,
  count: number,
): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < count; i++) {
    const v = values[i]!
    if (Number.isFinite(v)) {
      if (v < min) {
        min = v
      }
      if (v > max) {
        max = v
      }
    }
  }
  return [min, max]
}

/**
 * #api
 * The nearest-rank `quantile` of `a[0, n)`: the smallest value at least that
 * share of them sit at or below, so a handful of values clips at their
 * maximum. Permutes `a`; 0 where `n` is.
 */
export function quantileOf(a: Float32Array, n: number, quantile: number) {
  return n === 0
    ? 0
    : selectNth(a, n, Math.min(n - 1, Math.max(0, Math.ceil(quantile * n) - 1)))
}

function lowQuantileOf(a: Float32Array, n: number, quantile: number) {
  return n === 0
    ? 0
    : selectNth(a, n, Math.max(0, Math.min(n - 1, n - Math.ceil(quantile * n))))
}

/**
 * #api
 * What the open ends of a scale follow over `values[0, count)`: at a
 * `quantile` of 1 their finite extremes, and below it each end clipped at
 * that quantile of the values on its side of 0, so one spike takes neither
 * the axis nor the ramp, and a sparse tail of the other sign keeps its own
 * end. An axis that starts at 0 adds it itself. Under 0.5 reads as 0.5,
 * where the ends meet rather than cross. `scales.y.domainQuantile` and a
 * colour's `domainQuantile` both name it. `[Infinity, -Infinity]` where
 * nothing is finite.
 */
export function quantileExtent(
  values: ArrayLike<number>,
  count: number,
  quantile = 1,
): [number, number] {
  if (!(quantile < 1)) {
    return finiteExtremes(values, count)
  }
  const q = Math.max(0.5, quantile)
  const positive = new Float32Array(count)
  const negative = new Float32Array(count)
  let np = 0
  let nn = 0
  for (let i = 0; i < count; i++) {
    const v = values[i]!
    if (Number.isFinite(v)) {
      if (v >= 0) {
        positive[np++] = v
      } else {
        negative[nn++] = v
      }
    }
  }
  if (np + nn === 0) {
    return [Infinity, -Infinity]
  }
  const low =
    nn > 0 ? lowQuantileOf(negative, nn, q) : lowQuantileOf(positive, np, q)
  const high =
    np > 0 ? quantileOf(positive, np, q) : quantileOf(negative, nn, q)
  return [Math.min(low, high), high]
}
