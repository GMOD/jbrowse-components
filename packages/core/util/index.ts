import fromEntries from 'object.fromentries'
import { Feature } from './simpleFeature'
import { Region } from '../BaseAdapter'

// @ts-ignore
if (!Object.fromEntries) {
  fromEntries.shim()
}

export const inDevelopment =
  typeof process === 'object' &&
  process.env &&
  process.env.NODE_ENV === 'development'
export const inProduction = !inDevelopment

/**
 * Assemble a "locstring" from a location, like "ctgA:20-30".
 * The locstring uses 1-based coordinates.
 *
 * @param {string} args.refName reference sequence name
 * @param {number} args.start start coordinate
 * @param {number} args.end end coordinate
 * @returns {string} the locstring
 */
export function assembleLocString({ refName, start, end }: Region): string {
  return `${refName}:${start + 1}-${end}`
}

/**
 * Ensure that a number is at least min and at most max.
 *
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
export function clamp(num: number, min: number, max: number): number {
  if (num < min) return min
  if (num > max) return max
  return num
}

function roundToNearestPointOne(num: number): number {
  return Math.round(num * 10) / 10
}

/**
 * @param {number} bp
 * @param {Region} region
 * @param {number} bpPerPx
 * @param {boolean} [flipped] whether the current region
 *  is displayed flipped horizontally.  default false.
 */
export function bpToPx(
  bp: number,
  region: Region,
  bpPerPx: number,
  flipped: boolean = false,
): number {
  if (flipped) {
    return roundToNearestPointOne((region.end - bp) / bpPerPx)
  }
  return roundToNearestPointOne((bp - region.start) / bpPerPx)
}

export function featureSpanPx(
  feature: Feature,
  region: Region,
  bpPerPx: number,
  flipped: boolean = false,
): [number, number] {
  const start = bpToPx(feature.get('start'), region, bpPerPx, flipped)
  const end = bpToPx(feature.get('end'), region, bpPerPx, flipped)
  return flipped ? [end, start] : [start, end]
}

// @ts-ignore
export const objectFromEntries = Object.fromEntries.bind(Object)

// do an array map of an iterable
export function iterMap(
  iterable: any,
  func: Function,
  sizeHint: number,
): any[] {
  const results = sizeHint ? new Array(sizeHint) : []
  let counter = 0
  for (const item of iterable) {
    results[counter] = func(item)
    counter += 1
  }
  return results
}

/**
 * properly check if the given AbortSignal is aborted.
 * per the standard, if the signal reads as aborted,
 * this function throws either a DOMException AbortError, or a regular error
 * with a `code` attribute set to `ERR_ABORTED`.
 *
 * for convenience, passing `undefined` is a no-op
 *
 * @param {AbortSignal} [signal]
 * @returns nothing
 */
export function checkAbortSignal(signal?: AbortSignal): void {
  if (!signal) return

  if (inDevelopment && !(signal instanceof AbortSignal)) {
    throw new TypeError('must pass an AbortSignal')
  }

  if (signal.aborted) {
    if (typeof DOMException !== 'undefined') {
      throw new DOMException('aborted', 'AbortError')
    } else {
      const e = new Error('aborted')
      // @ts-ignore
      e.code = 'ERR_ABORTED'
      throw e
    }
  }
}

/**
 * check if the given exception was caused by an operation being intentionally aborted
 * @param {Error} exception
 * @returns {boolean}
 */
export function isAbortException(exception: any): boolean {
  return (
    // DOMException
    exception.name === 'AbortError' ||
    // standard-ish non-DOM abort exception
    exception.code === 'ERR_ABORTED' ||
    // stringified DOMException
    exception.message === 'AbortError: aborted' ||
    // stringified standard-ish exception
    exception.message === 'Error: aborted'
  )
}
