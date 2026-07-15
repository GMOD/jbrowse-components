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

// Fast number formatter with thousand separators.
// Benchmarked at 5-67x faster than toLocaleString('en-US')
export function toLocale(n: number) {
  if (n > -1000 && n < 1000) {
    return String(n)
  }
  const neg = n < 0
  const str = String(neg ? -n : n)
  const len = str.length
  let result = neg ? '-' : ''
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) {
      result += ','
    }
    result += str[i]
  }
  return result
}

export function reducePrecision(s: number, n = 3) {
  return toLocale(Number.parseFloat(s.toPrecision(n)))
}

const oneEightyOverPi = 180 / Math.PI
export function radToDeg(radians: number) {
  return (radians * oneEightyOverPi) % 360
}

export function polarToCartesian(rho: number, theta: number) {
  return [rho * Math.cos(theta), rho * Math.sin(theta)] as [number, number]
}
