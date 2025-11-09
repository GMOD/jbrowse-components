import { colord } from '@jbrowse/core/util/colord'

import type { ChainData } from './fetchChains'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0]!.flags & 1) {
      return true
    }
  }
  return false
}

/**
 * Cache of precomputed alpha colors for each base color
 * Maps baseColor -> array of 11 precomputed colors for p values [0, 0.1, 0.2, ..., 1.0]
 */
const alphaColorCache = new Map<string, string[]>()

/**
 * Precompute 11 alpha color variants for a given base color
 * (bins at p = 0.0, 0.1, 0.2, ..., 0.9, 1.0)
 */
function precomputeAlphaColors(baseColor: string): string[] {
  const bins: string[] = []
  for (let i = 0; i <= 10; i++) {
    const p = i / 10
    const alpha = Math.min(1, p * p + 0.1)
    bins[i] = colord(baseColor).alpha(alpha).toHslString()
  }
  return bins
}

/**
 * Get alpha-blended color from precomputed bins
 * Selects the nearest bin for fast lookup instead of computing alpha each time
 */
export function alphaColor(baseColor: string, p: number) {
  if (p === 1) {
    return baseColor
  }

  let bins = alphaColorCache.get(baseColor)
  if (!bins) {
    bins = precomputeAlphaColors(baseColor)
    alphaColorCache.set(baseColor, bins)
  }

  // Find nearest bin (0-10 scale)
  const binIndex = Math.max(0, Math.min(10, Math.round(p * 10)))
  return bins[binIndex]!
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
