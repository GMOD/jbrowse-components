import type React from 'react'

import { unzip } from '@gmod/bgzf-filehandle'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { coarseStripHTML } from './coarseStripHTML'
import { updateStatus } from './genomicCoords'
import { max } from './math'
import { getContainingView } from './mstUtils'
import { checkStopToken } from './stopToken'
import { isUriLocation } from './types'

import type { BaseBlock } from './blockTypes'
import type { BaseOptions } from '../data_adapters/BaseAdapter'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { GenericFilehandle } from 'generic-filehandle2'

// Re-exports from new modular files
export * from './hooks'
export * from './mstUtils'
export * from './genomicCoords'
export * from './sequence'
export * from './math'
export * from './collections'
export * from './springAnimate'
export * from './color'
export * from './localStorage'

// Existing re-exports
export * from './types'
export * from './when'
export * from './range'
export * from './dedupe'
export * from './coarseStripHTML'
export * from './offscreenCanvasPonyfill'
export * from './offscreenCanvasUtils'
export * from './rpc'

// this is recommended in a later comment in
// https://github.com/electron/electron/issues/2288 for detecting electron in a
// renderer process, which is the one that has node enabled for us
export const isElectron = /electron/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)

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

// prettier-ignore
const widths = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.2796875,0.2765625,0.3546875,0.5546875,0.5546875,0.8890625,0.665625,0.190625,0.3328125,0.3328125,0.3890625,0.5828125,0.2765625,0.3328125,0.2765625,0.3015625,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.5546875,0.2765625,0.2765625,0.584375,0.5828125,0.584375,0.5546875,1.0140625,0.665625,0.665625,0.721875,0.721875,0.665625,0.609375,0.7765625,0.721875,0.2765625,0.5,0.665625,0.5546875,0.8328125,0.721875,0.7765625,0.665625,0.7765625,0.721875,0.665625,0.609375,0.721875,0.665625,0.94375,0.665625,0.665625,0.609375,0.2765625,0.3546875,0.2765625,0.4765625,0.5546875,0.3328125,0.5546875,0.5546875,0.5,0.5546875,0.5546875,0.2765625,0.5546875,0.5546875,0.221875,0.240625,0.5,0.221875,0.8328125,0.5546875,0.5546875,0.5546875,0.5546875,0.3328125,0.5,0.2765625,0.5546875,0.5,0.721875,0.5,0.5,0.5,0.3546875,0.259375,0.353125,0.5890625]
const avgWidth = 0.5279276315789471

// xref https://gist.github.com/tophtucker/62f93a4658387bb61e4510c37e2e97cf
export function measureText(str: unknown, fontSize = 10) {
  const s = String(str)
  let total = 0
  for (let i = 0, l = s.length; i < l; i++) {
    total += widths[s.charCodeAt(i)] ?? avgWidth
  }
  return total * fontSize
}

export interface ViewSnap {
  bpPerPx: number
  interRegionPaddingWidth: number
  minimumBlockWidth: number
  width: number
  offsetPx: number
  staticBlocks: { contentBlocks: BaseBlock[]; blocks: BaseBlock[] }
  displayedRegions: (IStateTreeNode & {
    start: number
    end: number
    refName: string
    reversed?: boolean
    assemblyName: string
  })[]
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

export function getViewParams(model: any, exportSVG?: boolean) {
  // @ts-expect-error
  const { dynamicBlocks, staticBlocks, offsetPx } = getContainingView(model)
  const b = dynamicBlocks?.contentBlocks[0] || {}
  const staticblock = staticBlocks?.contentBlocks[0] || {}
  const staticblock1 = staticBlocks?.contentBlocks[1] || {}
  return {
    offsetPx: exportSVG ? 0 : offsetPx - staticblock.offsetPx,
    offsetPx1: exportSVG ? 0 : offsetPx - staticblock1.offsetPx,
    start: b.start as number,
    end: b.end as number,
  }
}

export function getLayoutId({
  sessionId,
  layoutId,
}: {
  sessionId: string
  layoutId: string
}) {
  return `${sessionId}-${layoutId}`
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
  } = args || {}
  return max(
    elements
      .map(element => getStr(element))
      .map(str => (stripHTML ? coarseStripHTML(str) : str))
      .map(str => measureText(str, fontSize))
      .map(n => Math.min(Math.max(n + padding, minWidth), maxWidth)),
  )
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

export function forEachWithStopTokenCheck<T>(
  iter: Iterable<T>,
  stopToken: string | undefined,
  arg: (arg: T, idx: number) => void,
  durationMs = 400,
  iters = 100,
) {
  let start = performance.now()
  let i = 0
  for (const t of iter) {
    arg(t, i++)
    if (iters % i === 0) {
      if (performance.now() - start > durationMs) {
        checkStopToken(stopToken)
        start = performance.now()
      }
    }
  }
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
} from './simpleFeature'

export { blobToDataURL } from './blobToDataURL'
export { makeAbortableReaction } from './makeAbortableReaction'
export * from './aborting'
export * from './linkify'
export * from './locString'
