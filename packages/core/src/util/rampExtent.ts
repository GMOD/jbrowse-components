/** How an open end of a colour ramp follows the values the display loaded. */
export const RAMP_AUTOSCALES = ['local', 'localpercentile'] as const
export type RampAutoscale = (typeof RAMP_AUTOSCALES)[number]

/** The percentile `localpercentile` clips at where a colour names none. */
export const DEFAULT_RAMP_QUANTILE = 0.99

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

function magnitudeAt(magnitudes: Float32Array, n: number, quantile: number) {
  return n === 0
    ? 0
    : selectNth(
        magnitudes,
        n,
        Math.min(n - 1, Math.max(0, Math.floor(quantile * (n - 1)))),
      )
}

/**
 * #api
 * What the open ends of a colour ramp follow over `values[0, count)`: their
 * finite extremes under `local`, and under `localpercentile` the `quantile`-th
 * percentile of each sign's magnitudes, anchored at 0 — the rule
 * `scales.y.autoscale` names the same way, so one spike no longer takes the
 * whole ramp. `[Infinity, -Infinity]` where nothing is finite.
 */
export function rampExtent(
  values: ArrayLike<number>,
  count: number,
  autoscale: RampAutoscale = 'local',
  quantile = DEFAULT_RAMP_QUANTILE,
): [number, number] {
  if (autoscale !== 'localpercentile') {
    return finiteExtremes(values, count)
  }
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
        negative[nn++] = -v
      }
    }
  }
  return np + nn === 0
    ? [Infinity, -Infinity]
    : [
        nn > 0 ? -magnitudeAt(negative, nn, quantile) : 0,
        np > 0 ? magnitudeAt(positive, np, quantile) : 0,
      ]
}
