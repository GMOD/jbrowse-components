import { SAM_FLAG_PAIRED } from './samFlags.ts'

import type { ChainData } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

/**
 * Check if ChainData contains paired-end reads
 * Note: This checks the data content, not the type.
 * For type-level checking, use hasPairedChainData() from fetchChains.ts
 */
export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0]!.get('flags') & SAM_FLAG_PAIRED) {
      return true
    }
  }
  return false
}

export const defaultFilterFlags = {
  flagInclude: 0,
  flagExclude: 1540,
}

export function isDefaultFilterFlags(
  filterBy:
    | {
        flagInclude?: number
        flagExclude?: number
        readName?: string
        tagFilter?: unknown
      }
    | undefined,
) {
  if (!filterBy) {
    return true
  }
  return (
    filterBy.flagInclude === 0 &&
    filterBy.flagExclude === 1540 &&
    !filterBy.readName &&
    !filterBy.tagFilter
  )
}
export const negFlags = {
  flagInclude: 16,
  flagExclude: 1540,
}
export const posFlags = {
  flagInclude: 0,
  flagExclude: 1556,
}

export function cacheGetter<T>(ctor: { prototype: T }, prop: keyof T): void {
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop)!
  const getter = desc.get!
  Object.defineProperty(ctor.prototype, prop, {
    get() {
      const ret = getter.call(this)
      Object.defineProperty(this, prop, { value: ret })
      return ret
    },
  })
}

export function filterReadFlag(
  flags: number,
  flagInclude: number,
  flagExclude: number,
) {
  if ((flags & flagInclude) !== flagInclude) {
    return true
  } else if (flags & flagExclude) {
    return true
  } else {
    return false
  }
}

export function filterTagValue(readVal: unknown, filterVal?: string) {
  return filterVal === '*'
    ? readVal === undefined
    : `${readVal}` !== `${filterVal}`
}

interface SamHeaderLine {
  tag: string
  data: { tag: string; value: string }[]
}

export interface ParsedSamHeader {
  idToName: string[]
  nameToId: Record<string, number>
  readGroups: string[]
}

/**
 * Parse SAM header lines into idToName, nameToId mappings and readGroups
 */
export function parseSamHeader(samHeader: SamHeaderLine[]): ParsedSamHeader {
  const idToName: string[] = []
  const nameToId: Record<string, number> = {}
  const readGroups: string[] = []
  let refId = 0
  let rgId = 0

  for (const element of samHeader) {
    const line = element
    if (line.tag === 'SQ') {
      const data = line.data
      for (const datum of data) {
        const item = datum
        if (item.tag === 'SN') {
          const refName = item.value
          nameToId[refName] = refId
          idToName[refId] = refName
          break
        }
      }
      refId++
    } else if (line.tag === 'RG') {
      const data = line.data
      for (const datum of data) {
        const item = datum
        if (item.tag === 'ID') {
          readGroups[rgId] = item.value
          break
        }
      }
      rgId++
    }
  }

  return { idToName, nameToId, readGroups }
}

export function getColorBaseMap(theme: Theme) {
  const { skip, deletion, insertion, hardclip, softclip, bases } = theme.palette
  return {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    deletion,
    insertion,
    hardclip,
    softclip,
    skip,
  }
}

export function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
}

export function shouldDrawSNPsMuted(type?: string) {
  return ['methylation', 'modifications'].includes(type || '')
}

export interface LayoutFeature {
  heightPx: number
  topPx: number
  feature: Feature
}

function isTypedArray(
  val: unknown,
): val is
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array {
  return ArrayBuffer.isView(val) && !(val instanceof DataView)
}

/**
 * Convert TypedArrays in tags object to plain number arrays.
 * This is needed because MobX State Tree cannot freeze TypedArray views.
 */
export function convertTagsToPlainArrays(
  tags: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tags)) {
    result[key] = isTypedArray(value) ? [...value] : value
  }
  return result
}

