import { toByteArray, fromByteArray } from 'base64-js'
import {
  getParent,
  IAnyStateTreeNode,
  getType,
  addDisposer,
  isAlive,
} from 'mobx-state-tree'
import { inflate, deflate } from 'pako'
import { Observable, fromEvent } from 'rxjs'
import fromEntries from 'object.fromentries'
import { useEffect, useRef, useState } from 'react'
import merge from 'deepmerge'
import { reaction, IReactionPublic } from 'mobx'
import { Feature } from './simpleFeature'
import { IRegion, INoAssemblyRegion } from '../mst-types'

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

export function useDebounce<T>(value: T, delay: number): T {
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

// https://stackoverflow.com/questions/56283920/how-to-debounce-a-callback-in-functional-component-using-hooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<A extends any[]>(
  callback: (...args: A) => void,
  wait = 400,
) {
  // track args & timeout handle between calls
  const argsRef = useRef<A>()
  const timeout = useRef<ReturnType<typeof setTimeout>>()

  function cleanup() {
    if (timeout.current) {
      clearTimeout(timeout.current)
    }
  }

  // make sure our timeout gets cleared if our consuming component gets unmounted
  useEffect(() => cleanup, [])

  return function debouncedCallback(...args: A) {
    // capture latest args
    argsRef.current = args

    // clear debounce timer
    cleanup()

    // start waiting again
    timeout.current = setTimeout(() => {
      if (argsRef.current) {
        callback(...argsRef.current)
      }
    }, wait)
  }
}

export function getSession(node: IAnyStateTreeNode): IAnyStateTreeNode {
  let currentNode = node
  // @ts-ignore
  while (isAlive(currentNode) && currentNode.pluginManager === undefined)
    currentNode = getParent(currentNode)
  return currentNode
}

export function getContainingView(
  node: IAnyStateTreeNode,
): IAnyStateTreeNode | undefined {
  const currentNode = getParent(node, 2)
  if (getType(currentNode).name.includes('View')) {
    return currentNode
  }
  return undefined
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

export interface ParsedLocString {
  assemblyName?: string
  refName: string
  start?: number
  end?: number
}

export function parseLocString(locstring: string): ParsedLocString {
  const ret = locstring.split(':')
  let refName = ''
  let assemblyName
  let rest
  if (ret.length >= 3) {
    ;[assemblyName, refName, rest] = ret
  } else if (ret.length === 2) {
    ;[refName, rest] = ret
  } else if (ret.length === 1) {
    ;[refName] = ret
  }
  if (rest) {
    // remove any whitespace
    rest = rest.replace(/\s/, '')
    // see if it's a range
    const rangeMatch = rest.match(/^(-?\d+)(\.\.|-)(-?\d+)$/)
    if (rangeMatch) {
      const [, start, , end] = rangeMatch
      if (start !== undefined && end !== undefined) {
        return { assemblyName, refName, start: +start, end: +end }
      }
    }
    // see if it's a single point
    const singleMatch = rest.match(/^(-?\d+)$/)
    if (singleMatch) {
      const [, start] = singleMatch
      if (start !== undefined) {
        return { assemblyName, refName, start: +start, end: +start }
      }
    }
  }
  return { assemblyName, refName }
}

export function parseLocStringAndConvertToInterbase(locstring: string) {
  const parsed = parseLocString(locstring)
  if (typeof parsed.start === 'number') parsed.start -= 1
  return parsed
}

export function compareLocStrings(a: string, b: string) {
  const locA = parseLocString(a)
  const locB = parseLocString(b)

  const assemblyComp =
    locA.assemblyName || locB.assemblyName
      ? (locA.assemblyName || '').localeCompare(locB.assemblyName || '')
      : 0
  if (assemblyComp) return assemblyComp

  const refComp =
    locA.refName || locB.refName
      ? (locA.refName || '').localeCompare(locB.refName || '')
      : 0
  if (refComp) return refComp

  if (locA.start !== undefined && locB.start !== undefined) {
    const startComp = locA.start - locB.start
    if (startComp) return startComp
  }
  if (locA.end !== undefined && locB.end !== undefined) {
    const endComp = locA.end - locB.end
    if (endComp) return endComp
  }
  return 0
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
  region: { start: number; end: number },
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
  region: { start: number; end: number },
  bpPerPx: number,
  flipped = false,
): [number, number] {
  return bpSpanPx(
    feature.get('start'),
    feature.get('end'),
    region,
    bpPerPx,
    flipped,
  )
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: { start: number; end: number },
  bpPerPx: number,
  flipped = false,
): [number, number] {
  const start = bpToPx(leftBp, region, bpPerPx, flipped)
  const end = bpToPx(rightBp, region, bpPerPx, flipped)
  return flipped ? [end, start] : [start, end]
}

export const objectFromEntries = Object.fromEntries.bind(Object)

// do an array map of an iterable
export function iterMap<T, U>(
  iterable: Iterable<T>,
  func: (item: T) => U,
  sizeHint?: number,
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
  includeAssemblyName = true,
): string {
  let s = ''
  if (includeAssemblyName && r.assemblyName) {
    s = `${r.assemblyName}:`
  }
  return `${s}${r.refName}:${r.start}..${r.end}`
}

class AbortError extends Error {
  public code: string | undefined
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
      const e = new AbortError('aborted')
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
    (exception as AbortError).code === 'ERR_ABORTED' ||
    // message contains aborted for bubbling through RPC
    // things we have seen that we want to catch here
    // Error: aborted
    // AbortError: aborted
    // AbortError: The user aborted a request.
    !!exception.message.match(/\b(aborted|AbortError)\b/i)
  )
}
interface Assembly {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface Track {
  trackId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface Config {
  savedSessions: unknown[]
  assemblies: Assembly[]
  tracks: Track[]
  defaultSession?: {}
}
// similar to electron.js
export function mergeConfigs(A: Config, B: Config) {
  const merged = merge(A, B)
  if (B.defaultSession) merged.defaultSession = B.defaultSession
  else if (A.defaultSession) merged.defaultSession = A.defaultSession
  return merged
}

/** returns a promise that will resolve a very short time later */
export function nextTick() {
  return new Promise(resolve => {
    setTimeout(resolve, 1)
  })
}

/**
 * makes a mobx reaction with the given functions, that calls actions
 * on the model for each stage of execution, and to abort the reaction function when the
 * model is destroyed.
 *
 * Will call flowNameStarted(signal), flowNameSuccess(result), and
 * flowNameError(error) actions on the given state tree model when the
 * async reaction function starts, completes, and errors respectively.
 *
 * @param {StateTreeNode} self
 * @param {string} flowName
 * @param {function} dataFunction -> data
 * @param {async_function} asyncReactionFunction(data, signal) -> result
 * @param {object} reactionOptions
 */
export function makeAbortableReaction<T, U>(
  self: T,
  flowName: string,
  dataFunction: (arg: T, name: string) => U,
  asyncReactionFunction: (
    arg: U | undefined,
    signal: AbortSignal,
    model: T,
    handle: IReactionPublic,
  ) => Promise<void>,
  reactionOptions: { name: string; fireImmediately: boolean; delay: number },
  startedFunction: (aborter: AbortController) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  successFunction: (arg: any) => void,
  errorFunction: (err: Error) => void,
) {
  let inProgress: AbortController | undefined

  function handleError(error: Error) {
    if (!isAbortException(error)) {
      if (isAlive(self)) {
        errorFunction(error)
      } else {
        console.error(error)
      }
    } else {
      console.log(`reaction ${reactionOptions.name} abort caught`)
    }
  }

  const reactionDisposer = reaction(
    () => {
      try {
        return dataFunction(self, flowName)
      } catch (error) {
        handleError(error)
        return undefined
      }
    },
    (data, mobxReactionHandle) => {
      if (inProgress && !inProgress.signal.aborted) {
        console.log(`reaction ${reactionOptions.name} abort requested (path 1)`)
        inProgress.abort()
      }

      if (!isAlive(self)) {
        return
      }
      inProgress = new AbortController()

      console.log(`reaction ${reactionOptions.name} fired`)

      const thisInProgress = inProgress
      startedFunction(thisInProgress)
      nextTick()
        .then(() =>
          asyncReactionFunction(
            data,
            thisInProgress.signal,
            self,
            mobxReactionHandle,
          ),
        )
        .then(result => {
          checkAbortSignal(thisInProgress.signal)
          if (isAlive(self)) {
            successFunction(result)
          }
        })
        .catch(error => {
          if (thisInProgress && !thisInProgress.signal.aborted) {
            console.log(
              `reaction ${reactionOptions.name} abort requested (path 2)`,
            )
            thisInProgress.abort()
          }
          handleError(error)
        })
    },
    reactionOptions,
  )

  addDisposer(self, reactionDisposer)
  addDisposer(self, () => {
    if (inProgress && !inProgress.signal.aborted) {
      console.log(`reaction ${reactionOptions.name} abort requested (path 3)`)
      inProgress.abort()
    }
  })
}
