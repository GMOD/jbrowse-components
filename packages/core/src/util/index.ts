import type React from 'react'

export { unzip } from '@gmod/bgzf-filehandle'
import { unzip } from '@gmod/bgzf-filehandle'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { coarseStripHTML } from './coarseStripHTML.ts'
import { colord } from './colord.ts'
import { measureText } from './measureText.ts'
import { max, toLocale } from './numericUtils.ts'
import { checkStopToken } from './stopToken.ts'
import { storeBlobLocation } from './tracks.ts'
import { isUriLocation } from './types/index.ts'

import type { StopToken } from './stopToken.ts'
import type { FileLocation } from './types/index.ts'
import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

export * from './types/index.ts'
export * from './when.ts'
export * from './range.ts'
export * from './dedupe.ts'
export * from './useFetch.ts'
export * from './fetchJson.ts'
export * from './sessionSharing.ts'
export * from './coarseStripHTML.ts'
export * from './measureText.ts'
export * from './scrollLatch.ts'
export * from './wheelZoom.ts'
export * from './numericUtils.ts'
export * from './bpUtils.ts'
export * from './intervals.ts'
export * from './springAnimate.ts'
export * from './hooks.ts'
export * from './localStorage.ts'
export * from './renameRegions.ts'
export * from './makeTrackId.ts'

export * from './offscreenCanvasPonyfill.ts'
export * from './rpc.ts'
export * from './crypto.ts'
export * from './openFeatureWidget.ts'
export {
  findParentThat,
  findParentThatIs,
  getContainingDisplay,
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  hashCode,
  objectHash,
} from './mstUtils.ts'

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

// equivalent to the `detect-node` package: true only inside a real Node.js
// process, not in browsers where `process` may be polyfilled by the bundler
// (the toString brand is '[object process]' only for the genuine global).
// `process` isn't in core's browser-targeted build lib, so read it off
// globalThis rather than referencing the bare global
export const isNode =
  Object.prototype.toString.call(
    (globalThis as { process?: unknown }).process,
  ) === '[object process]'

/**
 * Convert a browser File (from a drop zone or file input) into a FileLocation:
 * a native local path under electron, or an in-memory blob location otherwise.
 */
export function fileToLocation(file: File): FileLocation {
  if (isElectron) {
    return {
      // @ts-ignore - electron injects require onto window, needs to be ignore not expect-error for now
      localPath: window.require('electron').webUtils.getPathForFile(file),
      locationType: 'LocalPathLocation',
    }
  } else {
    const loc = storeBlobLocation({ blob: file })
    if ('blobId' in loc) {
      return loc
    } else {
      throw new Error('could not store file as a blob location')
    }
  }
}

export * from './seqUtils.ts'

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

export function getLayoutId({
  sessionId,
  trackInstanceId,
}: {
  sessionId: string
  trackInstanceId: string
}) {
  return `${sessionId}-${trackInstanceId}`
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

export function truncateMiddle(str: string, maxLen = 40) {
  if (str.length <= maxLen) {
    return str
  }
  const half = Math.floor((maxLen - 3) / 2)
  return `${str.slice(0, half)}...${str.slice(-half)}`
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
  // eslint-disable-next-line @eslint-react/dom-no-flush-sync
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
export {
  type SaveSvgAsImageOptions,
  saveSvgAsImage,
  svgHtmlToPngBlob,
} from './saveSvgAsImage.ts'
export { makeAbortableReaction } from './makeAbortableReaction.ts'
export * from './aborting.ts'
export * from './linkify.ts'
export * from './locString.ts'
export * from './stopToken.ts'
export * from './tracks.ts'
export * from './fileHandleStore.ts'
export { IntervalTree } from './IntervalTree.ts'
export { useRenderingBackend } from './useRenderingBackend.ts'
export { makeDisplayedRegionKey } from './blockTypes.ts'
export { cmpStr } from './cmpStr.ts'
export {
  type AlignmentData,
  type DiagonalizationResult,
  type DiagonalizeTick,
  diagonalizeRegions,
} from './diagonalizeRegions.ts'
