import { toByteArray, fromByteArray } from 'base64-js'
import {
  getParent,
  isAlive,
  IAnyStateTreeNode,
  hasParent,
  addDisposer,
} from 'mobx-state-tree'
import { reaction, IReactionPublic, IReactionOptions } from 'mobx'
import { inflate, deflate } from 'pako'
import { Observable, fromEvent } from 'rxjs'
import fromEntries from 'object.fromentries'
import { useEffect, useRef, useState } from 'react'
import merge from 'deepmerge'
import { Feature } from './simpleFeature'
import {
  TypeTestedByPredicate,
  isSessionModel,
  isViewModel,
  Region,
  NoAssemblyRegion,
} from './types'

export * from './types'

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
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param str-  a string to compress and encode
 */
export function toUrlSafeB64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  const deflated = deflate(bytes)
  const encoded = fromByteArray(deflated)
  const pos = encoded.indexOf('=')
  return pos > 0
    ? encoded.slice(0, pos).replace(/\+/g, '-').replace(/\//g, '_')
    : encoded.replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 * @param b64 - a base64 string to decode and inflate
 */
export function fromUrlSafeB64(b64: string): string {
  const originalB64 = b64PadSuffix(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = toByteArray(originalB64)
  const inflated = inflate(bytes)
  return new TextDecoder().decode(inflated)
}

/**
 * Pad the end of a base64 string with "=" to make it valid
 * @param b64 - unpadded b64 string
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

/** find the first node in the hierarchy that matches the given predicate */
export function findParentThat(
  node: IAnyStateTreeNode,
  predicate: (thing: IAnyStateTreeNode) => boolean,
) {
  let currentNode: IAnyStateTreeNode | undefined = node
  while (currentNode && isAlive(currentNode)) {
    if (predicate(currentNode)) return currentNode
    if (hasParent(currentNode)) currentNode = getParent(currentNode)
    else break
  }
  throw new Error('no matching node found')
}

interface Animation {
  lastPosition: number
  lastTime?: number
  lastVelocity?: number
}

// based on https://github.com/react-spring/react-spring/blob/cd5548a987383b8023efd620f3726a981f9e18ea/src/animated/FrameLoop.ts
export function springAnimate(
  fromValue: number,
  toValue: number,
  setValue: (value: number) => void,
  onFinish = () => {},
  precision = 0,
  tension = 170,
  friction = 26,
) {
  const mass = 1
  if (!precision) {
    precision = Math.abs(toValue - fromValue) / 1000
  }

  let animationFrameId: number

  function update(animation: Animation) {
    const time = Date.now()
    let position = animation.lastPosition
    let lastTime = animation.lastTime || time
    let velocity = animation.lastVelocity || 0
    // If we lost a lot of frames just jump to the end.
    if (time > lastTime + 64) {
      lastTime = time
    }
    // http://gafferongames.com/game-physics/fix-your-timestep/
    const numSteps = Math.floor(time - lastTime)
    for (let i = 0; i < numSteps; ++i) {
      const force = -tension * (position - toValue)
      const damping = -friction * velocity
      const acceleration = (force + damping) / mass
      velocity += (acceleration * 1) / 1000
      position += (velocity * 1) / 1000
    }
    const isVelocity = Math.abs(velocity) <= precision
    const isDisplacement =
      tension !== 0 ? Math.abs(toValue - position) <= precision : true
    const endOfAnimation = isVelocity && isDisplacement
    if (endOfAnimation) {
      setValue(toValue)
      onFinish()
    } else {
      setValue(position)
      animationFrameId = requestAnimationFrame(() =>
        update({
          lastPosition: position,
          lastTime: time,
          lastVelocity: velocity,
        }),
      )
    }
  }

  return [
    () => update({ lastPosition: fromValue }),
    () => cancelAnimationFrame(animationFrameId),
  ]
}

/** find the first node in the hierarchy that matches the given 'is' typescript type guard predicate */
export function findParentThatIs<
  PREDICATE extends (thing: IAnyStateTreeNode) => boolean
>(
  node: IAnyStateTreeNode,
  predicate: PREDICATE,
): TypeTestedByPredicate<PREDICATE> & IAnyStateTreeNode {
  return findParentThat(node, predicate) as TypeTestedByPredicate<PREDICATE> &
    IAnyStateTreeNode
}

/** get the current JBrowse session model, starting at any node in the state tree */
export function getSession(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isSessionModel)
  } catch (e) {
    throw new Error('no session model found!')
  }
}

/** get the state model of the view in the state tree that contains the given node */
export function getContainingView(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isViewModel)
  } catch (e) {
    throw new Error('no containing view found')
  }
}

/**
 * Assemble a "locString" from a location, like "ctgA:20-30".
 * The locString uses 1-based coordinates.
 *
 * @param region - Region
 * @returns the locString
 */
export function assembleLocString(region: Region | NoAssemblyRegion): string {
  const { refName, start, end } = region
  let assemblyName
  if ((region as Region).assemblyName) ({ assemblyName } = region as Region)
  if (assemblyName) return `${assemblyName}:${refName}:${start + 1}..${end}`
  return `${refName}:${start + 1}..${end}`
}

export interface ParsedLocString {
  assemblyName?: string
  refName: string
  start?: number
  end?: number
}

export function parseLocString(locString: string): ParsedLocString {
  if (!locString)
    throw new Error('no location string provided, could not parse')
  // remove any whitespace
  locString = locString.replace(/\s/, '')
  const ret = locString.split(':')
  let refName = ''
  let assemblyName
  let rest
  if (ret.length > 3) {
    throw new Error(`too many ":", could not parse location "${locString}"`)
  } else if (ret.length === 3) {
    ;[assemblyName, refName, rest] = ret
  } else if (ret.length === 2) {
    ;[refName, rest] = ret
  } else {
    ;[refName] = ret
  }
  if (rest) {
    // see if it's a range
    const rangeMatch = rest.match(/^(-?\d+)(\.\.|-)(-?\d+)$/)
    // see if it's a single point
    const singleMatch = rest.match(/^(-?\d+)(\.\.|-)?$/)
    if (rangeMatch) {
      const [, start, , end] = rangeMatch
      if (start !== undefined && end !== undefined) {
        return { assemblyName, refName, start: +start, end: +end }
      }
    } else if (singleMatch) {
      const [, start, separator] = singleMatch
      if (start !== undefined) {
        if (separator) {
          // indefinite end
          return { assemblyName, refName, start: +start }
        }
        return { assemblyName, refName, start: +start, end: +start }
      }
    } else {
      throw new Error(`could not parse range "${rest}" on refName "${refName}"`)
    }
  }
  return { assemblyName, refName }
}

export function parseLocStringAndConvertToInterbase(locString: string) {
  const parsed = parseLocString(locString)
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
 * @param num -
 * @param min -
 * @param  max -
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
 * @param bp -
 * @param region -
 * @param bpPerPx -
 */
export function bpToPx(
  bp: number,
  region: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
): number {
  if (region.reversed) {
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
 * @param x - the x
 * @param y - the y
 * @returns [rho, theta]
 */
export function cartesianToPolar(x: number, y: number): [number, number] {
  const rho = Math.sqrt(x * x + y * y)
  const theta = Math.atan(y / x)
  return [rho, theta]
}

export function featureSpanPx(
  feature: Feature,
  region: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
): [number, number] {
  return bpSpanPx(feature.get('start'), feature.get('end'), region, bpPerPx)
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: { start: number; end: number; reversed?: boolean },
  bpPerPx: number,
): [number, number] {
  const start = bpToPx(leftBp, region, bpPerPx)
  const end = bpToPx(rightBp, region, bpPerPx)
  return region.reversed ? [end, start] : [start, end]
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
 * @param signal -
 * @returns nothing
 */
export function checkAbortSignal(signal?: AbortSignal): void {
  if (!signal) return

  if (inDevelopment && !(signal instanceof AbortSignal)) {
    throw new TypeError('must pass an AbortSignal')
  }

  if (signal.aborted) {
    if (typeof DOMException !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
 * @param exception -
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

// https://stackoverflow.com/a/53187807
/**
 * Returns the index of the last element in the array where predicate is true,
 * and -1 otherwise.
 * @param array - The source array to search in
 * @param predicate - find calls predicate once for each element of the array, in
 * descending order, until it finds one where predicate returns true. If such an
 * element is found, findLastIndex immediately returns that element index.
 * Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: Array<T>,
  predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
  let l = array.length
  while (l--) {
    if (predicate(array[l], l, array)) {
      return l
    }
  }
  return -1
}

/**
 * makes a mobx reaction with the given functions, that calls actions on the
 * model for each stage of execution, and to abort the reaction function when
 * the model is destroyed.
 *
 * Will call startedFunction(signal), successFunction(result), and
 * errorFunction(error) when the async reaction function starts, completes, and
 * errors respectively.
 *
 * @param self -
 * @param dataFunction -
 * @param asyncReactionFunction -
 * @param reactionOptions -
 * @param startedFunction -
 * @param successFunction -
 * @param errorFunction -
 */
export function makeAbortableReaction<T, U, V>(
  self: T,
  dataFunction: (arg: T) => U,
  asyncReactionFunction: (
    arg: U | undefined,
    signal: AbortSignal,
    model: T,
    handle: IReactionPublic,
  ) => Promise<V>,
  reactionOptions: IReactionOptions,
  startedFunction: (aborter: AbortController) => void,
  successFunction: (arg: V) => void,
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
    }
  }

  const reactionDisposer = reaction(
    () => {
      try {
        return dataFunction(self)
      } catch (error) {
        handleError(error)
        return undefined
      }
    },
    (data, mobxReactionHandle) => {
      if (inProgress && !inProgress.signal.aborted) {
        inProgress.abort()
      }

      if (!isAlive(self)) {
        return
      }
      inProgress = new AbortController()

      const thisInProgress = inProgress
      startedFunction(thisInProgress)
      Promise.resolve()
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
          if (thisInProgress && !thisInProgress.signal.aborted)
            thisInProgress.abort()
          handleError(error)
        })
    },
    reactionOptions,
  )

  addDisposer(self, reactionDisposer)
  addDisposer(self, () => {
    if (inProgress && !inProgress.signal.aborted) {
      inProgress.abort()
    }
  })
}

export function minmax(a: number, b: number) {
  return [Math.min(a, b), Math.max(a, b)]
}
