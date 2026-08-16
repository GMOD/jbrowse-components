export function clamp(num: number, min: number, max: number) {
  if (num < min) {
    return min
  }
  if (num > max) {
    return max
  }
  return num
}

export function minmax(a: number, b: number) {
  return [Math.min(a, b), Math.max(a, b)] as const
}

// Index iteration so these accept both arrays and typed arrays (e.g.
// Float32Array) without requiring Iterable.

export function max(arr: ArrayLike<number>, init = Number.NEGATIVE_INFINITY) {
  let max = init
  for (let i = 0; i < arr.length; i++) {
    max = Math.max(arr[i]!, max)
  }
  return max
}

// Like max() but skips NaN/Infinity entries rather than propagating them (a
// single NaN poisons Math.max). Used where an array can legitimately carry
// gaps, e.g. a score series with unmeasured bins in it.
export function maxFinite(
  arr: ArrayLike<number>,
  init = Number.NEGATIVE_INFINITY,
) {
  let max = init
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]!
    if (Number.isFinite(v) && v > max) {
      max = v
    }
  }
  return max
}

export function min(arr: ArrayLike<number>, init = Number.POSITIVE_INFINITY) {
  let min = init
  for (let i = 0; i < arr.length; i++) {
    min = Math.min(arr[i]!, min)
  }
  return min
}

export function sum(arr: ArrayLike<number>) {
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]!
  }
  return sum
}

export function avg(arr: ArrayLike<number>) {
  return sum(arr) / arr.length
}

// Thousand separators are a display convention, not part of the number. They
// make a coordinate readable, but they survive a copy-paste into tools that
// then choke on them, so users who copy coordinates out of the app more than
// they read them can turn them off (the `numberGrouping` preference).
//
// A plain variable rather than an observable, because every number the app
// displays funnels through here — including strings built worker-side, where a
// jexl `mouseover` slot formats a tooltip against the full feature. A
// main-thread-only reactive value would leave those stale, so the app would sit
// half-formatted until every track refetched. Instead each realm sets this once
// at startup (the worker gets it in its boot configuration, see RpcManager) and
// the preference asks for a reload, which buys uniformity for one page load.
let numberGrouping = true

export function setNumberGrouping(enabled: boolean) {
  numberGrouping = enabled
}

// read when handing the setting to another realm; not a display path
export function getNumberGrouping() {
  return numberGrouping
}

// Fast number formatter with thousand separators.
// Benchmarked at 5-67x faster than toLocaleString('en-US')
export function toLocale(n: number) {
  const abs = Math.abs(n)
  // `!(abs >= 1000)` also covers NaN, which has no digits to group, and
  // String() switches to exponential form at 1e21 and for Infinity, where a
  // thousands separator is meaningless
  if (!numberGrouping || !(abs >= 1000) || abs >= 1e21) {
    return String(n)
  }
  const str = String(abs)
  // separators count from the decimal point, not the end of the string
  const intLen = Number.isInteger(abs) ? str.length : str.indexOf('.')
  let result = n < 0 ? '-' : ''
  for (let i = 0; i < intLen; i++) {
    if (i > 0 && (intLen - i) % 3 === 0) {
      result += ','
    }
    result += str[i]
  }
  return intLen === str.length ? result : result + str.slice(intLen)
}

// numeric significant-figure rounding; reducePrecision is the formatted form
export function toPrecision(s: number, n = 3) {
  return Number.parseFloat(s.toPrecision(n))
}

export function reducePrecision(s: number, n = 3) {
  return toLocale(toPrecision(s, n))
}

/**
 * A byte count as a person reads it. Shared by the region-too-large banner and
 * the save-track-data dialog, which quote the same index estimate and would
 * otherwise word the same number two ways.
 */
export function getDisplayStr(totalBytes: number) {
  // pick the unit from the rounded value so e.g. 999,999 bytes reads "1 Mb"
  // rather than "1000 Kb"
  const mb = toPrecision(totalBytes / 1_000_000)
  const kb = toPrecision(totalBytes / 1000)
  if (mb >= 1) {
    return `${mb} Mb`
  } else if (kb >= 1) {
    return `${kb} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
  }
}

const oneEightyOverPi = 180 / Math.PI
export function radToDeg(radians: number) {
  return (radians * oneEightyOverPi) % 360
}

export function polarToCartesian(rho: number, theta: number) {
  return [rho * Math.cos(theta), rho * Math.sin(theta)] as [number, number]
}
