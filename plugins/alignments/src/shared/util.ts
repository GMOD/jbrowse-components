import { colord } from '@jbrowse/core/util/colord'

import type { ChainData } from './types'

/**
 * Check if ChainData contains paired-end reads
 * Note: This checks the data content, not the type.
 * For type-level checking, use hasPairedChainData() from fetchChains.ts
 */
export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0]!.get('flags') & 1) {
      return true
    }
  }
  return false
}

export function alphaColor(baseColor: string, p: number) {
  return p !== 1
    ? colord(baseColor)
        .alpha(Math.min(1, p * p + 0.1))
        .toHslString()
    : baseColor
}

export const defaultFilterFlags = {
  flagInclude: 0,
  flagExclude: 1540,
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

/**
 * Determine if chevrons should be rendered based on zoom level and feature height
 * @param bpPerPx - base pairs per pixel (zoom level)
 * @param featureHeight - height of the feature in pixels
 * @returns true if chevrons should be rendered
 */
export function shouldRenderChevrons(bpPerPx: number, featureHeight: number) {
  return bpPerPx < 50 && featureHeight >= 3
}

/**
 * Width of chevron pointer in pixels
 */
export const CHEVRON_WIDTH = 5

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
