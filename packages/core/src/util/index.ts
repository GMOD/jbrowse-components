import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import { unzip } from '@gmod/bgzf-filehandle'
import useMeasure from '@jbrowse/core/util/useMeasure'
import {
  getEnv as getEnvMST,
  getParent,
  getSnapshot,
  hasParent,
  isAlive,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { coarseStripHTML } from './coarseStripHTML.ts'
import { colord } from './colord.ts'
import { parseLocString } from './locString.ts'
import { measureText } from './measureText.ts'
import { checkStopToken } from './stopToken.ts'
import {
  isDisplayModel,
  isSessionModel,
  isTrackModel,
  isUriLocation,
  isViewModel,
} from './types/index.ts'

import type { ParsedLocString } from './locString.ts'
import type PluginManager from '../PluginManager.ts'
import type { Feature } from './simpleFeature.ts'
import type { StopToken } from './stopToken.ts'
import type {
  AbstractDisplayModel,
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
  AssemblyManager,
  Region,
  TypeTestedByPredicate,
} from './types/index.ts'
import type { Region as MUIRegion } from './types/mst.ts'
import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type {
  IAnyStateTreeNode,
  Instance,
} from '@jbrowse/mobx-state-tree'
import type { GenericFilehandle } from 'generic-filehandle2'

export * from './types/index.ts'
export * from './when.ts'
export * from './range.ts'
export * from './dedupe.ts'
export * from './useFetch.ts'
export * from './coarseStripHTML.ts'
export * from './measureText.ts'
export { IntervalTree } from './IntervalTree.ts'

export * from './offscreenCanvasPonyfill.ts'
export * from './offscreenCanvasUtils.tsx'
export * from './rpc.ts'
export * from './crypto.ts'

// WeakMap caches for containing model lookups to avoid repeated tree traversal
const containingDisplayCache = new WeakMap<
  IAnyStateTreeNode,
  AbstractDisplayModel
>()
const containingTrackCache = new WeakMap<
  IAnyStateTreeNode,
  AbstractTrackModel
>()
const containingViewCache = new WeakMap<IAnyStateTreeNode, AbstractViewModel>()
const sessionCache = new WeakMap<IAnyStateTreeNode, AbstractSessionModel>()

export function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handle)
    }
  }, [value, delay])

  return debouncedValue
}

// used in ViewContainer files to get the width
export function useWidthSetter(
  view: { setWidth: (arg: number) => void },
  padding: string,
) {
  const [ref, { width }] = useMeasure()
  useEffect(() => {
    let token: ReturnType<typeof requestAnimationFrame>
    if (width && isAlive(view)) {
      // sets after a requestAnimationFrame
      // https://stackoverflow.com/a/58701523/2129219
      // avoids ResizeObserver loop error being shown during development
      token = requestAnimationFrame(() => {
        view.setWidth(width)
      })
    }

    return () => {
      if (token) {
        cancelAnimationFrame(token)
      }
    }
  }, [padding, view, width])
  return ref
}

type Timer = ReturnType<typeof setTimeout>

// https://stackoverflow.com/questions/56283920/
export function useDebouncedCallback<T>(
  callback: (...args: T[]) => void,
  wait = 400,
) {
  // track args & timeout handle between calls
  const argsRef = useRef<T[]>(null)
  const timeout = useRef<Timer>(null)

  // make sure our timeout gets cleared if our consuming component gets
  // unmounted
  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current)
    }
  }, [])

  return function debouncedCallback(...args: T[]) {
    // capture latest args
    argsRef.current = args

    // clear debounce timer
    if (timeout.current) {
      clearTimeout(timeout.current)
    }

    // start waiting again
    timeout.current = setTimeout(() => {
      if (argsRef.current) {
        callback(...argsRef.current)
      }
    }, wait)
  }
}

/**
 * find the first node in the hierarchy that matches the given predicate
 */
export function findParentThat(
  node: IAnyStateTreeNode,
  predicate: (thing: IAnyStateTreeNode) => boolean,
) {
  if (!hasParent(node)) {
    throw new Error('node does not have parent')
  }
  let currentNode = getParent(node)

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (currentNode && isAlive(currentNode)) {
    if (predicate(currentNode)) {
      return currentNode
    }
    if (hasParent(currentNode)) {
      currentNode = getParent<any>(currentNode)
    } else {
      break
    }
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
  tension = 400,
  friction = 20,
  clamp = true,
) {
  const mass = 1
  if (!precision) {
    precision = Math.abs(toValue - fromValue) / 1000
  }

  let animationFrameId: number

  function update(animation: Animation) {
    const time = performance.now()
    let position = animation.lastPosition
    let lastTime = animation.lastTime ?? time
    let velocity = animation.lastVelocity ?? 0
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
    const isOvershooting =
      clamp && tension !== 0
        ? fromValue < toValue
          ? position > toValue
          : position < toValue
        : false
    const endOfAnimation = isOvershooting || (isVelocity && isDisplacement)
    if (endOfAnimation) {
      setValue(toValue)
      onFinish()
    } else {
      setValue(position)
      animationFrameId = requestAnimationFrame(() => {
        update({
          lastPosition: position,
          lastTime: time,
          lastVelocity: velocity,
        })
      })
    }
  }

  return [
    () => {
      update({ lastPosition: fromValue })
    },
    () => {
      cancelAnimationFrame(animationFrameId)
    },
  ]
}

/**
 * find the first node in the hierarchy that matches the given 'is' typescript
 * type guard predicate
 */
export function findParentThatIs<T extends (a: IAnyStateTreeNode) => boolean>(
  node: IAnyStateTreeNode,
  predicate: T,
) {
  return findParentThat(node, predicate) as TypeTestedByPredicate<T>
}

function cachedParent<T extends IAnyStateTreeNode>(
  cache: WeakMap<IAnyStateTreeNode, T>,
  node: IAnyStateTreeNode,
  finder: () => T,
  errorMsg: string,
): T {
  const cached = cache.get(node)
  if (cached && isAlive(cached)) {
    return cached
  }
  try {
    const result = finder()
    cache.set(node, result)
    return result
  } catch (e) {
    throw new Error(errorMsg, { cause: e })
  }
}

/**
 * get the current JBrowse session model, starting at any node in the state
 * tree. Results are cached for performance.
 */
export function getSession(node: IAnyStateTreeNode): AbstractSessionModel {
  return cachedParent(
    sessionCache,
    node,
    () => findParentThatIs(node, isSessionModel),
    'no session model found!',
  )
}

/**
 * get the state model of the view in the state tree that contains the given
 * node. Results are cached for performance.
 */
export function getContainingView(node: IAnyStateTreeNode): AbstractViewModel {
  return cachedParent(
    containingViewCache,
    node,
    () => findParentThatIs(node, isViewModel),
    'no containing view found',
  )
}

/**
 * get the state model of the track in the state tree that contains the given
 * node. Results are cached for performance.
 */
export function getContainingTrack(
  node: IAnyStateTreeNode,
): AbstractTrackModel {
  return cachedParent(
    containingTrackCache,
    node,
    () => findParentThatIs(node, isTrackModel),
    'no containing track found',
  )
}

/**
 * get the state model of the display in the state tree that contains the given
 * node. Results are cached for performance.
 */
export function getContainingDisplay(
  node: IAnyStateTreeNode,
): AbstractDisplayModel {
  return cachedParent(
    containingDisplayCache,
    node,
    () => findParentThatIs(node, isDisplayModel),
    'no containing display found',
  )
}

/**
 * Assemble a 1-based "locString" from an interbase genomic location
 * @param region - Region
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0, end: 100 })
 * // ↳ 'chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ assemblyName: 'hg19', refName: 'chr1', start: 0, end: 100 })
 * // ↳ '{hg19}chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1' })
 * // ↳ 'chr1'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0 })
 * // ↳ 'chr1:1..'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', end: 100 })
 * // ↳ 'chr1:1..100'
 * ```
 * @example
 * ```ts
 * assembleLocString({ refName: 'chr1', start: 0, end: 1 })
 * // ↳ 'chr1:1'
 * ```
 */
export function assembleLocString(region: ParsedLocString) {
  return assembleLocStringFast(region, toLocale)
}

// same as assembleLocString above, but does not perform toLocaleString which
// can slow down the speed of block calculations which use assembleLocString
// for block.key
export function assembleLocStringFast(
  region: ParsedLocString,
  cb = (n: number): string | number => n,
) {
  const { assemblyName, refName, start, end, reversed } = region
  const assemblyNameString = assemblyName ? `{${assemblyName}}` : ''
  let startString: string
  if (start !== undefined) {
    startString = `:${cb(start + 1)}`
  } else if (end !== undefined) {
    startString = ':1'
  } else {
    startString = ''
  }
  let endString: string
  if (end !== undefined) {
    endString = start !== undefined && start + 1 === end ? '' : `..${cb(end)}`
  } else {
    endString = start !== undefined ? '..' : ''
  }
  let rev = ''
  if (reversed) {
    rev = '[rev]'
  }
  return `${assemblyNameString}${refName}${startString}${endString}${rev}`
}
export function compareLocs(locA: ParsedLocString, locB: ParsedLocString) {
  const assemblyComp =
    locA.assemblyName || locB.assemblyName
      ? (locA.assemblyName || '').localeCompare(locB.assemblyName || '')
      : 0
  if (assemblyComp) {
    return assemblyComp
  }

  const refComp =
    locA.refName || locB.refName
      ? (locA.refName || '').localeCompare(locB.refName || '')
      : 0
  if (refComp) {
    return refComp
  }

  if (locA.start !== undefined && locB.start !== undefined) {
    const startComp = locA.start - locB.start
    if (startComp) {
      return startComp
    }
  }
  if (locA.end !== undefined && locB.end !== undefined) {
    const endComp = locA.end - locB.end
    if (endComp) {
      return endComp
    }
  }
  return 0
}

export function compareLocStrings(
  a: string,
  b: string,
  isValidRefName: (refName: string, assemblyName?: string) => boolean,
) {
  const locA = parseLocString(a, isValidRefName)
  const locB = parseLocString(b, isValidRefName)
  return compareLocs(locA, locB)
}

/**
 * Ensure that a number is at least min and at most max.
 *
 * @param num -
 * @param min -
 * @param  max -
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

function roundToNearestPointOne(num: number) {
  return Math.round(num * 10) / 10
}

/**
 * @param bp -
 * @param region -
 * @param bpPerPx -
 */
export function bpToPx(
  bp: number,
  {
    reversed,
    end = 0,
    start = 0,
  }: { start?: number; end?: number; reversed?: boolean },
  bpPerPx: number,
) {
  return roundToNearestPointOne((reversed ? end - bp : bp - start) / bpPerPx)
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
interface MinimalRegion {
  start: number
  end: number
  reversed?: boolean
}

export function featureSpanPx(
  feature: Feature,
  region: MinimalRegion,
  bpPerPx: number,
) {
  return bpSpanPx(feature.get('start'), feature.get('end'), region, bpPerPx)
}

export function bpSpanPx(
  leftBp: number,
  rightBp: number,
  region: MinimalRegion,
  bpPerPx: number,
) {
  const start = bpToPx(leftBp, region, bpPerPx)
  const end = bpToPx(rightBp, region, bpPerPx)
  return region.reversed ? ([end, start] as const) : ([start, end] as const)
}

/**
 * Calculate layout bounds for a feature, accounting for reversed regions.
 *
 * When labels are wider than features, the layout needs extra space:
 * - Normal: extend towards higher genomic coords (visual right)
 * - Reversed: extend towards lower genomic coords (visual right when reversed)
 *
 * This ensures labels always extend towards visual right of the feature.
 *
 * @param featureStart - Feature's genomic start coordinate
 * @param featureEnd - Feature's genomic end coordinate
 * @param layoutWidthBp - Total layout width in base pairs (may include label space)
 * @param reversed - Whether the region is reversed
 * @returns [layoutStart, layoutEnd] in genomic coordinates
 */
export function calculateLayoutBounds(
  featureStart: number,
  featureEnd: number,
  layoutWidthBp: number,
  reversed?: boolean,
): [number, number] {
  const featureWidthBp = featureEnd - featureStart
  const labelOverhangBp = Math.max(0, layoutWidthBp - featureWidthBp)

  // When reversed, extend towards lower genomic coords (visual right when reversed)
  // When normal, extend towards higher genomic coords (visual right when normal)
  return reversed
    ? [featureStart - labelOverhangBp, featureEnd]
    : [featureStart, featureStart + layoutWidthBp]
}

// do an array map of an iterable
export function iterMap<T, U>(
  iter: Iterable<T>,
  func: (arg: T) => U,
  sizeHint?: number,
) {
  const results = Array.from<U>({ length: sizeHint ?? 0 })
  let counter = 0
  for (const item of iter) {
    results[counter] = func(item)
    counter += 1
  }
  return results
}

/**
 * Returns the index of the last element in the array where predicate is true,
 * and -1 otherwise. Based on https://stackoverflow.com/a/53187807
 *
 * @param array - The source array to search in
 *
 * @param predicate - find calls predicate once for each element of the array, in
 * descending order, until it finds one where predicate returns true.
 *
 * @returns findLastIndex returns element index where predicate is true.
 * Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
) {
  let l = array.length
  while (l--) {
    if (predicate(array[l]!, l, array)) {
      return l
    }
  }
  return -1
}

export function findLast<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
) {
  let l = array.length
  while (l--) {
    if (predicate(array[l]!, l, array)) {
      return array[l]
    }
  }
  return undefined
}

// Maps a region's refName to the track adapter's name (via refNameMap), and
// sets originalRefName to the seq adapter (FASTA) name so that CRAM/BAM
// adapters can fetch reference sequence correctly.
export function renameRegionIfNeeded(
  refNameMap: Record<string, string> | undefined,
  region: Region | Instance<typeof MUIRegion>,
  getSeqAdapterRefName?: (refName: string) => string,
): Region & { originalRefName?: string } {
  if (isStateTreeNode(region) && !isAlive(region)) {
    return region
  }
  const newRef = refNameMap?.[region.refName]
  if (newRef) {
    return {
      ...(isStateTreeNode(region) ? getSnapshot(region) : region),
      refName: newRef,
      originalRefName: getSeqAdapterRefName?.(region.refName) ?? region.refName,
    }
  }
  return region
}

export async function renameRegionsIfNeeded<
  ARGTYPE extends {
    assemblyName?: string
    regions?: Region[]
    stopToken?: StopToken
    adapterConfig: Record<string, unknown>
    sessionId: string
    statusCallback?: (arg: string) => void
  },
>(assemblyManager: AssemblyManager, args: ARGTYPE) {
  const { regions = [], adapterConfig } = args
  if (!args.sessionId) {
    throw new Error('sessionId is required')
  }

  // capture assembly names before the await, since MST regions may be dead after
  const assemblyNames = regions.map(r => r.assemblyName)
  const uniqueAssemblyNames = [...new Set(assemblyNames)]
  const assemblyData = Object.fromEntries(
    await Promise.all(
      uniqueAssemblyNames.map(async name => [
        name,
        {
          refNameMap: await assemblyManager.getRefNameMapForAdapter(
            adapterConfig,
            name,
            args,
          ),
          assembly: assemblyManager.get(name),
        },
      ]),
    ),
  )

  return {
    ...args,
    regions: regions.map((region, i) => {
      const { refNameMap, assembly } = assemblyData[assemblyNames[i]!]
      return renameRegionIfNeeded(
        refNameMap,
        region,
        assembly ? r => assembly.getSeqAdapterRefName(r) : undefined,
      )
    }),
  }
}

export function minmax(a: number, b: number) {
  return [Math.min(a, b), Math.max(a, b)] as const
}

export function shorten(name: string, max = 70, short = 30) {
  return name.length > max
    ? `${name.slice(0, short)}...${name.slice(-short)}`
    : name
}

export function shorten2(name: string, max = 70) {
  return name.length > max ? `${name.slice(0, max)}...` : name
}

export function stringify(
  {
    refName,
    coord,
    assemblyName,
    oob,
  }: {
    assemblyName?: string
    coord: number
    refName?: string
    oob?: boolean
  },
  useAssemblyName?: boolean,
) {
  return [
    assemblyName && useAssemblyName ? `{${assemblyName}}` : '',
    refName
      ? `${shorten(refName)}:${toLocale(coord)}${oob ? ' (out of bounds)' : ''}`
      : '',
  ].join('')
}

// this is recommended in a later comment in
// https://github.com/electron/electron/issues/2288 for detecting electron in a
// renderer process, which is the one that has node enabled for us
//
// const isElectron = process.versions.electron
// const i2 = process.versions.hasOwnProperty('electron')
export const isElectron = /electron/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)

// from bioperl: tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/
// generated with:
// perl -MJSON -E '@l = split "","acgtrymkswhbvdnxACGTRYMKSWHBVDNX"; print to_json({ map { my $in = $_; tr/acgtrymkswhbvdnxACGTRYMKSWHBVDNX/tgcayrkmswdvbhnxTGCAYRKMSWDVBHNX/; $in => $_ } @l})'
export const complementTable = {
  S: 'S',
  w: 'w',
  T: 'A',
  r: 'y',
  a: 't',
  N: 'N',
  K: 'M',
  x: 'x',
  d: 'h',
  Y: 'R',
  V: 'B',
  y: 'r',
  M: 'K',
  h: 'd',
  k: 'm',
  C: 'G',
  g: 'c',
  t: 'a',
  A: 'T',
  n: 'n',
  W: 'W',
  X: 'X',
  m: 'k',
  v: 'b',
  B: 'V',
  s: 's',
  H: 'D',
  c: 'g',
  D: 'H',
  b: 'v',
  R: 'Y',
  G: 'C',
} as Record<string, string>

export function revcom(str: string) {
  const revcomped = []
  for (let i = str.length - 1; i >= 0; i--) {
    revcomped.push(complementTable[str[i]!] ?? str[i])
  }
  return revcomped.join('')
}

export function reverse(str: string) {
  const reversed = []
  for (let i = str.length - 1; i >= 0; i--) {
    reversed.push(str[i]!)
  }
  return reversed.join('')
}

export function complement(str: string) {
  const comp = []
  for (let i = 0, l = str.length; i < l; i++) {
    comp.push(complementTable[str[i]!] ?? str[i]!)
  }
  return comp.join('')
}

// requires immediate execution in jest environment, because (hypothesis) it
// otherwise listens for prerendered_canvas but reads empty pixels, and doesn't
// get the contents of the canvas
export const rIC =
  typeof jest === 'undefined'
    ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback
      : (cb: () => void) =>
          setTimeout(() => {
            cb()
          }, 1)
    : (cb: () => void) => {
        cb()
      }

export type Frame = 1 | 2 | 3 | -1 | -2 | -3

export function getFrame(
  start: number,
  end: number,
  strand: 1 | -1,
  phase: 0 | 1 | 2,
): Frame {
  return strand === 1
    ? ((((start + phase) % 3) + 1) as 1 | 2 | 3)
    : ((-1 * ((end - phase) % 3) - 1) as -1 | -2 | -3)
}

export const defaultStarts = ['ATG']
export const defaultStops = ['TAA', 'TAG', 'TGA']
export const defaultCodonTable = {
  TCA: 'S',
  TCC: 'S',
  TCG: 'S',
  TCT: 'S',
  TTC: 'F',
  TTT: 'F',
  TTA: 'L',
  TTG: 'L',
  TAC: 'Y',
  TAT: 'Y',
  TAA: '*',
  TAG: '*',
  TGC: 'C',
  TGT: 'C',
  TGA: '*',
  TGG: 'W',
  CTA: 'L',
  CTC: 'L',
  CTG: 'L',
  CTT: 'L',
  CCA: 'P',
  CCC: 'P',
  CCG: 'P',
  CCT: 'P',
  CAC: 'H',
  CAT: 'H',
  CAA: 'Q',
  CAG: 'Q',
  CGA: 'R',
  CGC: 'R',
  CGG: 'R',
  CGT: 'R',
  ATA: 'I',
  ATC: 'I',
  ATT: 'I',
  ATG: 'M',
  ACA: 'T',
  ACC: 'T',
  ACG: 'T',
  ACT: 'T',
  AAC: 'N',
  AAT: 'N',
  AAA: 'K',
  AAG: 'K',
  AGC: 'S',
  AGT: 'S',
  AGA: 'R',
  AGG: 'R',
  GTA: 'V',
  GTC: 'V',
  GTG: 'V',
  GTT: 'V',
  GCA: 'A',
  GCC: 'A',
  GCG: 'A',
  GCT: 'A',
  GAC: 'D',
  GAT: 'D',
  GAA: 'E',
  GAG: 'E',
  GGA: 'G',
  GGC: 'G',
  GGG: 'G',
  GGT: 'G',
}

/**
 * take CodonTable above and generate larger codon table that includes all
 * permutations of upper and lower case nucleotides
 */
export function generateCodonTable(table: Record<string, string>) {
  const tempCodonTable: Record<string, string> = {}
  for (const codon of Object.keys(table)) {
    const aa = table[codon]!
    const nucs: string[][] = []
    for (let i = 0; i < 3; i++) {
      const nuc = codon.charAt(i)
      nucs[i] = []
      nucs[i]![0] = nuc.toUpperCase()
      nucs[i]![1] = nuc.toLowerCase()
    }
    for (let i = 0; i < 2; i++) {
      const n0 = nucs[0]![i]!
      for (let j = 0; j < 2; j++) {
        const n1 = nucs[1]![j]!
        for (let k = 0; k < 2; k++) {
          const n2 = nucs[2]![k]!
          const triplet = n0 + n1 + n2
          tempCodonTable[triplet] = aa
        }
      }
    }
  }
  return tempCodonTable
}

export const codonTable = generateCodonTable(defaultCodonTable)

// call statusCallback with current status and clear when finished
export async function updateStatus<U>(
  msg: string,
  cb: ((arg: string) => void) | undefined,
  fn: () => U | Promise<U>,
) {
  cb?.(msg)
  const res = await fn()
  cb?.('')
  return res
}

// call statusCallback with current status and clear when finished, and check
// stopToken afterwards
export async function updateStatus2<U>(
  msg: string,
  cb: (arg: string) => void,
  stopToken: StopToken | undefined,
  fn: () => U | Promise<U>,
) {
  cb(msg)
  const res = await fn()
  checkStopToken(stopToken)
  cb('')
  return res
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

interface VirtualOffset {
  blockPosition: number
}

interface Block {
  minv: VirtualOffset
  maxv: VirtualOffset
}

export async function bytesForRegions(
  regions: Region[],
  index: {
    blocksForRange: (
      ref: string,
      start: number,
      end: number,
    ) => Promise<Block[]>
  },
) {
  const blockResults = await Promise.all(
    regions.map(r => index.blocksForRange(r.refName, r.start, r.end)),
  )

  return sum(
    blockResults
      .flat()
      .map(
        block => block.maxv.blockPosition + 65535 - block.minv.blockPosition,
      ),
  )
}


// Supported adapter types by text indexer ensure that this matches the method
// found in @jbrowse/text-indexing/util
export function isSupportedIndexingAdapter(type = '') {
  return [
    'Gff3TabixAdapter',
    'VcfTabixAdapter',
    'Gff3Adapter',
    'VcfAdapter',
  ].includes(type)
}

export function getBpDisplayStr(total: number) {
  if (Math.floor(total / 1_000_000) > 0) {
    return `${reducePrecision(total / 1_000_000)}Mbp`
  } else if (Math.floor(total / 1_000) > 0) {
    return `${reducePrecision(total / 1_000)}Kbp`
  } else {
    return `${Math.floor(total)}bp`
  }
}

export function reducePrecision(s: number, n = 3) {
  return toLocale(Number.parseFloat(s.toPrecision(n)))
}

export function getProgressDisplayStr(current: number, total: number) {
  if (Math.floor(total / 1_000_000) > 0) {
    return `${reducePrecision(current / 1_000_000)}/${reducePrecision(total / 1_000_000)}Mb`
  } else if (Math.floor(total / 1_000) > 0) {
    return `${reducePrecision(current / 1_000)}/${reducePrecision(total / 1_000)}Kb`
  } else {
    return `${reducePrecision(current)}/${reducePrecision(total)} bytes`
  }
}

// Fast number formatter with thousand separators
// Benchmarked at 5-67x faster than toLocaleString('en-US')
export function toLocale(n: number) {
  if (n < 1000) {
    return String(n)
  }
  const str = String(n)
  const len = str.length
  let result = ''
  for (let i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 === 0) {
      result += ','
    }
    result += str[i]
  }
  return result
}

export function getTickDisplayStr(totalBp: number, bpPerPx: number) {
  return Math.floor(bpPerPx / 1_000) > 0
    ? `${toLocale(Number.parseFloat((totalBp / 1_000_000).toFixed(2)))}M`
    : toLocale(Math.floor(totalBp))
}

export function getLayoutId({
  sessionId,
  trackInstanceId,
}: {
  sessionId: string
  trackInstanceId: string
}) {
  return `${sessionId}-${trackInstanceId}`
}

export function getStatsId({
  sessionId,
  trackInstanceId,
}: {
  sessionId: string
  trackInstanceId: string
}) {
  return `${sessionId}-${trackInstanceId}`
}

// Hook from https://usehooks.com/useLocalStorage/
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  enabled = true,
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined' || !enabled) {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        // eslint-disable-next-line unicorn/no-instanceof-builtins
        value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined' && enabled) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }
  return [storedValue, setValue] as const
}

export function getUriLink(value: { uri: string; baseUri?: string }) {
  const { uri, baseUri = '' } = value
  let href: string
  try {
    href = new URL(uri, baseUri).href
  } catch (e) {
    href = uri
  }
  return href
}

export function getStr(obj: unknown) {
  return isObject(obj)
    ? isUriLocation(obj)
      ? getUriLink(obj)
      : JSON.stringify(obj)
    : String(obj)
}

// heuristic measurement for a column of a @mui/x-data-grid, pass in
// values from a column
export function measureGridWidth(
  elements: unknown[],
  args?: {
    minWidth?: number
    fontSize?: number
    maxWidth?: number
    padding?: number
    stripHTML?: boolean
  },
) {
  const {
    padding = 30,
    minWidth = 80,
    fontSize = 12,
    maxWidth = 1000,
    stripHTML = false,
  } = args ?? {}
  return max(
    elements
      .map(element => getStr(element))
      .map(str => (stripHTML ? coarseStripHTML(str) : str))
      .map(str => measureText(str, fontSize))
      .map(n => Math.min(Math.max(n + padding, minWidth), maxWidth)),
  )
}

export function getEnv(obj: any) {
  return getEnvMST<{ pluginManager: PluginManager }>(obj)
}

export function localStorageGetItem(item: string) {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(item)
    : undefined
}

export function localStorageSetItem(str: string, item: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(str, item)
  }
}

// Index iteration so these accept both arrays and typed arrays (e.g.
// Float32Array) without requiring Iterable.
/* eslint-disable @typescript-eslint/prefer-for-of */
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
/* eslint-enable @typescript-eslint/prefer-for-of */

export function avg(arr: ArrayLike<number>) {
  return sum(arr) / arr.length
}

export function groupBy<T>(array: Iterable<T>, predicate: (v: T) => string) {
  const result: Record<string, T[]> = {}
  for (const value of array) {
    const t = predicate(value)
    result[t] ??= []
    result[t].push(value)
  }
  return result
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function mergeIntervals<T extends { start: number; end: number }>(
  intervals: T[],
  w = 5000,
) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals
  }

  const stack: T[] = []

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => a.start - b.start)

  // push the 1st interval into the stack
  stack.push(intervals[0]!)

  // start from the next interval and merge if needed
  for (let i = 1; i < intervals.length; i++) {
    // get the top element
    const top = stack.at(-1)!

    // if the current interval doesn't overlap with the
    // stack top element, push it to the stack
    if (top.end + w < intervals[i]!.start - w) {
      stack.push(intervals[i]!)
    }
    // otherwise update the end value of the top element
    // if end of current interval is higher
    else if (top.end < intervals[i]!.end) {
      top.end = Math.max(top.end, intervals[i]!.end)
      stack.pop()
      stack.push(top)
    }
  }

  return stack
}

export interface BasicFeature {
  end: number
  start: number
  refName: string
}

// returns new array non-overlapping features
export function gatherOverlaps<T extends BasicFeature>(regions: T[], w = 5000) {
  const memo: Record<string, T[]> = {}
  for (const x of regions) {
    memo[x.refName] ??= []
    memo[x.refName]!.push(x)
  }

  return Object.values(memo).flatMap(group =>
    mergeIntervals(
      group.sort((a, b) => a.start - b.start),
      w,
    ),
  )
}

export function stripAlpha(str: string) {
  return colord(str).alpha(1).toHex()
}

export function getStrokeProps(str: string) {
  if (str) {
    const c = colord(str)
    return {
      strokeOpacity: c.alpha(),
      stroke: c.alpha(1).toHex(),
    }
  } else {
    return {}
  }
}

export function getFillProps(str: string) {
  if (str) {
    const c = colord(str)
    return {
      fillOpacity: c.alpha(),
      fill: c.alpha(1).toHex(),
    }
  } else {
    return {}
  }
}

// https://react.dev/reference/react-dom/server/renderToString#removing-rendertostring-from-the-client-code
export function renderToStaticMarkup(node: React.ReactElement) {
  const div = document.createElement('div')
  flushSync(() => {
    createRoot(div).render(node)
  })
  return div.innerHTML.replaceAll(/\brgba\((.+?),[^,]+?\)/g, 'rgb($1)')
}

export function isGzip(buf: Uint8Array) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export async function fetchAndMaybeUnzip(
  loc: GenericFilehandle,
  opts: BaseOptions = {},
) {
  const { statusCallback = () => {} } = opts
  const buf = await updateStatus(
    'Downloading file',
    statusCallback,
    () => loc.readFile(opts) as Promise<Uint8Array>,
  )
  return isGzip(buf)
    ? await updateStatus('Unzipping', statusCallback, () => unzip(buf))
    : buf
}

export async function fetchAndMaybeUnzipText(
  loc: GenericFilehandle,
  opts?: BaseOptions,
) {
  const buffer = await fetchAndMaybeUnzip(loc, opts)
  // 512MB  max chrome string length is 512MB
  if (buffer.length > 536_870_888) {
    throw new Error('Data exceeds maximum string length (512MB)')
  }
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}

// MIT https://github.com/inspect-js/is-object
export function isObject(
  x: unknown,
): x is Record<string | symbol | number, unknown> {
  return typeof x === 'object' && x !== null
}

export function localStorageGetNumber(key: string, defaultVal: number) {
  return +(localStorageGetItem(key) ?? defaultVal)
}

export function localStorageGetBoolean(key: string, defaultVal: boolean) {
  return Boolean(
    JSON.parse(localStorageGetItem(key) || JSON.stringify(defaultVal)),
  )
}

export function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

export function testAdapter(
  fileName: string,
  regex: RegExp,
  adapterHint: string | undefined,
  expected: string,
) {
  return (regex.test(fileName) && !adapterHint) || adapterHint === expected
}

export {
  type Feature,
  type SimpleFeatureSerialized,
  type SimpleFeatureSerializedNoId,
  default as SimpleFeature,
  isFeature,
} from './simpleFeature.ts'

export { blobToDataURL } from './blobToDataURL.ts'
export { saveAs } from './FileSaver/index.ts'
export { makeAbortableReaction } from './makeAbortableReaction.ts'
export * from './aborting.ts'
export * from './linkify.ts'
export * from './locString.ts'
export * from './stopToken.ts'
export * from './tracks.ts'
export * from './fileHandleStore.ts'
export { useGpuModelLifecycle } from './useGpuModelLifecycle.ts'
export { useGpuRenderer } from './useGpuRenderer.ts'
export { makeDisplayedRegionKey } from './blockTypes.ts'
export {
  type AlignmentData,
  type DiagonalizationResult,
  type ProgressCallback,
  diagonalizeRegions,
} from './diagonalizeRegions.ts'
