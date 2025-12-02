/**
 * Ensure that a number is at least min and at most max.
 */
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

const oneEightyOverPi = 180 / Math.PI
const piOverOneEighty = Math.PI / 180

export function radToDeg(radians: number) {
  return (radians * oneEightyOverPi) % 360
}

export function degToRad(degrees: number) {
  return (degrees * piOverOneEighty) % (2 * Math.PI)
}

/**
 * @returns [x, y]
 */
export function polarToCartesian(rho: number, theta: number) {
  return [rho * Math.cos(theta), rho * Math.sin(theta)] as [number, number]
}

/**
 * @param x - the x
 * @param y - the y
 * @returns [rho, theta]
 */
export function cartesianToPolar(x: number, y: number) {
  const rho = Math.sqrt(x * x + y * y)
  const theta = Math.atan(y / x)
  return [rho, theta] as [number, number]
}

export function max(arr: Iterable<number>, init = Number.NEGATIVE_INFINITY) {
  let max = init
  for (const entry of arr) {
    max = Math.max(entry, max)
  }
  return max
}

export function min(arr: Iterable<number>, init = Number.POSITIVE_INFINITY) {
  let min = init
  for (const entry of arr) {
    min = Math.min(entry, min)
  }
  return min
}

export function sum(arr: Iterable<number>) {
  let sum = 0
  for (const entry of arr) {
    sum += entry
  }
  return sum
}

export function avg(arr: number[]) {
  return sum(arr) / arr.length
}

export function hashCode(str: string) {
  let hash = 0
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

export function objectHash(obj: Record<string, any>) {
  return `${hashCode(JSON.stringify(obj))}`
}
