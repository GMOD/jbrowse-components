import { toByteArray, fromByteArray } from 'base64-js'
import { getParent, isAlive, IAnyStateTreeNode } from 'mobx-state-tree'
import { inflate, deflate } from 'pako'
import { Observable, fromEvent } from 'rxjs'
import fromEntries from 'object.fromentries'
import { useEffect, useState } from 'react'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebounce(value: any, delay: number): any {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

export function getSession(node: IAnyStateTreeNode): IAnyStateTreeNode {
  let currentNode = node
  // @ts-ignore
  while (isAlive(currentNode) && currentNode.pluginManager === undefined)
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

export function parseLocString(
  locstring: string,
): {
  assemblyName?: string
  refName?: string
  start?: number
  end?: number
} {
  const ret = locstring.split(':')
  let refName
  let assemblyName
  let rest
  if (ret.length === 3) {
    ;[assemblyName, refName, rest] = ret
  } else if (ret.length === 2) {
    ;[refName, rest] = ret
  } else if (ret.length === 1) {
    ;[refName] = ret
  }
  if (rest) {
    const [start, end] = rest.split('..')
    if (start !== undefined && end !== undefined) {
      return { assemblyName, refName, start: +start, end: +end }
    }
    if (start !== undefined) {
      return { assemblyName, refName, start: +start }
    }
  }
  return { assemblyName, refName }
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
  flipped = false,
): number {
  if (flipped) {
    return roundToNearestPointOne((region.end - bp) / bpPerPx)
  }
  return roundToNearestPointOne((bp - region.start) / bpPerPx)
}

const oneEightyOverPi = 180.0 / Math.PI
const piOverOneEighty = Math.PI / 180.0
export function radToDeg(radians: number): number {
  return (radians * oneEightyOverPi) % 360
}
export function degToRad(degrees: number): number {
  return (degrees * piOverOneEighty) % (2 * Math.PI)
}

/**
 * @returns [x, y]
 */
export function polarToCartesian(rho: number, theta: number): [number, number] {
  return [rho * Math.cos(theta), rho * Math.sin(theta)]
}

/**
 * @param x the x
 * @param y the y
 * @returns [rho, theta]
 */
export function cartesianToPolar(x: number, y: number): [number, number] {
  const rho = Math.sqrt(x * x + y * y)
  const theta = Math.atan(y / x)
  return [rho, theta]
}

export function featureSpanPx(
  feature: Feature,
  region: IRegion,
  bpPerPx: number,
  flipped = false,
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

export function generateLocString(
  r: IRegion,
  tied: boolean,
  includeAssemblyName = true,
): string {
  if (tied) {
    return r.refName
  }
  let s = ''
  if (includeAssemblyName && r.assemblyName) {
    s = `${r.assemblyName}:`
  }
  return `${s}${r.refName}:${r.start}..${r.end}`
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

export function observeAbortSignal(signal?: AbortSignal): Observable<Event> {
  if (!signal) return Observable.create()
  return fromEvent(signal, 'abort')
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

// export function getSnapshotIfNode(thing: Node): Record<string, any> {
//   if (isStateTreeNode(thing)) return getSnapshot(thing)
//   return thing
// }
