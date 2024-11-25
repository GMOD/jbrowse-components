import type { ChainData } from '../shared/fetchChains'

export function hasPairedReads(features: ChainData) {
  for (const f of features.chains.values()) {
    if (f[0]!.flags & 1) {
      return true
    }
  }
  return false
}
