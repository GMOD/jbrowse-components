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

export function alphaColor(baseColor: string, p: number) {
  return p !== 1
    ? colord(baseColor)
        .alpha(p * p)
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
