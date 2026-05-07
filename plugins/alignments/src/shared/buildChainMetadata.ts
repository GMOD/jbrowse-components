import { groupBy, max, min } from '@jbrowse/core/util'

import { getInsertSizeStats } from './insertSizeStats.ts'

import type { ChainStats } from './types.ts'
import type { ChainFeatureData } from './webglRpcTypes.ts'

const SAM_FLAG_PROPER_PAIR = 2
const SAM_FLAG_REVERSE = 16
const SAM_FLAG_SECONDARY = 256
const SAM_FLAG_SUPPLEMENTARY = 2048

/**
 * Group chain features by name and compute per-chain metadata used by the
 * main-thread layout. Returns the chain-keyed TypedArrays plus a worker-local
 * map (`featureIdToChainIdx`) the read-array loop uses to attach reads to
 * chains. `chainFirstReadIndices` is allocated zero-filled — the caller fills
 * it during the read-array pass, since it indexes into the read arrays.
 */
export function buildChainMetadata(features: ChainFeatureData[]) {
  const featuresByName = groupBy(features, f => f.name)
  const chains = Object.values(featuresByName)
  const numChains = chains.length

  const tlens: number[] = []
  for (const f of features) {
    if (
      f.flags & SAM_FLAG_PROPER_PAIR &&
      !(f.flags & SAM_FLAG_SECONDARY) &&
      !(f.flags & SAM_FLAG_SUPPLEMENTARY)
    ) {
      const tlen = f.templateLength
      if (tlen !== 0 && !Number.isNaN(tlen)) {
        tlens.push(Math.abs(tlen))
      }
    }
  }

  let chainStats: ChainStats | undefined
  if (tlens.length > 0) {
    const insertSizeStats = getInsertSizeStats(tlens)
    chainStats = {
      ...insertSizeStats,
      max: max(tlens),
      min: min(tlens),
    }
  }

  const chainAbsMinStarts = new Uint32Array(numChains)
  const chainAbsMaxEnds = new Uint32Array(numChains)
  const chainDistances = new Uint32Array(numChains)
  const chainNames: string[] = []
  // Worker-local: drives readChainHasSupp in the read-array loop. Not part of
  // the result transferred to the main thread.
  const chainSuppTypes = new Uint8Array(numChains)
  const chainHasMultiple = new Uint8Array(numChains)
  const chainFirstReadIndices = new Uint32Array(numChains)

  const featureIdToChainIdx = new Map<string, number>()
  for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
    const chain = chains[chainIdx]!
    let minStart = Number.MAX_VALUE
    let maxEnd = Number.MIN_VALUE
    let hasSupp = false
    let primaryStrand = 1
    for (const f of chain) {
      if (f.start < minStart) {
        minStart = f.start
      }
      if (f.end > maxEnd) {
        maxEnd = f.end
      }
      if (f.flags & SAM_FLAG_SUPPLEMENTARY) {
        hasSupp = true
      } else {
        primaryStrand = f.flags & SAM_FLAG_REVERSE ? -1 : 1
      }
      featureIdToChainIdx.set(f.id, chainIdx)
    }
    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.templateLength || 0)
      if (tlen > 0) {
        distance = tlen
      }
    }
    chainAbsMinStarts[chainIdx] = minStart
    chainAbsMaxEnds[chainIdx] = maxEnd
    chainDistances[chainIdx] = distance
    chainNames.push(chain[0]!.name)
    chainSuppTypes[chainIdx] = hasSupp ? (primaryStrand === -1 ? 2 : 1) : 0
    chainHasMultiple[chainIdx] = chain.length >= 2 ? 1 : 0
  }

  return {
    chainStats,
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainSuppTypes,
    chainHasMultiple,
    chainFirstReadIndices,
    featureIdToChainIdx,
  }
}
