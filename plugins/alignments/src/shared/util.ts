import { ChainData } from './fetchChains'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0]!.flags & 1) {
      return true
    }
  }
  return false
}

export function probabilityToAlpha(p: number) {
  return p * p + 0.1
}
