import { toByteArray, fromByteArray } from 'base64-js'
import { getParent, IAnyStateTreeNode } from 'mobx-state-tree'
import { inflate, deflate } from 'pako'
import fromEntries from 'object.fromentries'
import { Feature } from './simpleFeature'
import { IRegion, INoAssemblyRegion } from '../mst-types'

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
 * Compress and encode a string as url-safe base64
 * @param str a string to compress and encode
 * @see https://en.wikipedia.org/wiki/Base64#URL_applications
 */
export function toUrlSafeB64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const deflated = deflate(bytes)
  const encoded = fromByteArray(deflated)
  const pos = encoded.indexOf('=')
  return pos > 0
    ? encoded
        .slice(0, pos)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
    : encoded.replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Decode and inflate a url-safe base64 to a string
 * @param b64 a base64 string to decode and inflate
 * @see https://en.wikipedia.org/wiki/Base64#URL_applications
 */
export function fromUrlSafeB64(b64: string): string {
  const originalB64 = b64PadSuffix(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = toByteArray(originalB64)
  const inflated = inflate(bytes)
  return new TextDecoder().decode(inflated)
}

/**
 * Pad the end of a base64 string with "=" to make it valid
 * @param b64 unpadded b64 string
 */
function b64PadSuffix(b64: string): string {
  let num = 0
  const mo = b64.length % 4
  switch (mo) {
    case 3:
      num = 1
      break
    case 2:
      num = 2
      break
    case 0:
      num = 0
      break
    default:
      throw new Error('base64 not a valid length')
  }
  return b64 + '='.repeat(num)
}

export function getSession(node: IAnyStateTreeNode): IAnyStateTreeNode {
  let currentNode = node
  // @ts-ignore
  while (currentNode.pluginManager === undefined)
    currentNode = getParent(currentNode)
  return currentNode
}

/**
 * Assemble a "locstring" from a location, like "ctgA:20-30".
 * The locstring uses 1-based coordinates.
 *
 * @param {string} args.refName reference sequence name
 * @param {number} args.start start coordinate
 * @param {number} args.end end coordinate
 * @returns {string} the locstring
 */
export function assembleLocString(region: IRegion | INoAssemblyRegion): string {
  const { refName, start, end } = region
  let assemblyName
  if ((region as IRegion).assemblyName) ({ assemblyName } = region as IRegion)
  if (assemblyName) return `${assemblyName}:${refName}:${start + 1}-${end}`
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
 * @param {IRegion} region
 * @param {number} bpPerPx
 * @param {boolean} [flipped] whether the current region
 *  is displayed flipped horizontally.  default false.
 */
export function bpToPx(
  bp: number,
  region: IRegion,
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
  region: IRegion,
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
export function iterMap<T, U>(
  iterable: Iterable<T>,
  func: (item: T) => U,
  sizeHint: number,
): U[] {
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
export function isAbortException(exception: Error): boolean {
  return (
    // DOMException
    exception.name === 'AbortError' ||
    // standard-ish non-DOM abort exception
    // @ts-ignore
    exception.code === 'ERR_ABORTED' ||
    // message contains aborted for bubbling through RPC
    // things we have seen that we want to catch here
    // Error: aborted
    // AbortError: aborted
    // AbortError: The user aborted a request.
    !!exception.message.match(/\b(aborted|AbortError)\b/i)
  )
}
