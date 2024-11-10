import { colord } from '@jbrowse/core/util/colord'
import { ChainData } from './fetchChains'

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
