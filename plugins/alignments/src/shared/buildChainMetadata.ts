import {
  SAM_FLAG_REVERSE,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'
import { groupBy } from '@jbrowse/core/util'

import { chainGroupingKey } from './chainGroupingKey.ts'

import type { ChainFeatureData } from './webglRpcTypes.ts'

/**
 * Group chain features by name and compute per-chain metadata used by the
 * main-thread layout. Returns the chain-keyed TypedArrays plus a worker-local
 * map (`featureIdToChainIdx`) the read-array loop uses to attach reads to
 * chains. `chainFirstReadIndices` is allocated zero-filled — the caller fills
 * it during the read-array pass, since it indexes into the read arrays.
 *
 * Insert-size stats are NOT computed here: they describe the whole region's
 * read set, not one group, so the worker entry computes one shared scale across
 * all groups (see computeChainInsertSizeStats).
 */
export function buildChainMetadata(features: ChainFeatureData[]) {
  const featuresByChain = groupBy(features, f =>
    chainGroupingKey(f.name, f.id, f.flags),
  )
  const chainEntries = Object.entries(featuresByChain)
  const numChains = chainEntries.length

  const chainAbsMinStarts = new Uint32Array(numChains)
  const chainAbsMaxEnds = new Uint32Array(numChains)
  const chainDistances = new Uint32Array(numChains)
  const chainNames: string[] = []
  // Worker-local: drives readChainHasSupp in the read-array loop. Not part of
  // the result transferred to the main thread.
  const chainSuppTypes = new Uint8Array(numChains)
  // Pair orientation (0=unknown, 1=LR, 2=RL, 3=RR, 4=LL) taken from the chain's
  // primary read, so supplementary segments can inherit the pair's orientation
  // rather than the divergent one their own strand-flipped record computes.
  const chainPairOrientations = new Uint8Array(numChains)
  const chainHasMultiple = new Uint8Array(numChains)
  const chainFirstReadIndices = new Uint32Array(numChains)

  const featureIdToChainIdx = new Map<string, number>()
  for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
    const [chainKey, chain] = chainEntries[chainIdx]!
    let minStart = Number.POSITIVE_INFINITY
    let maxEnd = Number.NEGATIVE_INFINITY
    let hasSupp = false
    let primaryStrand = 1
    let primaryPairOrientation = 0
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
        primaryPairOrientation = f.pairOrientation
      }
      featureIdToChainIdx.set(f.id, chainIdx)
    }
    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.templateLength)
      if (tlen > 0) {
        distance = tlen
      }
    }
    chainAbsMinStarts[chainIdx] = minStart
    chainAbsMaxEnds[chainIdx] = maxEnd
    chainDistances[chainIdx] = distance
    // For normal chains this is the QNAME; secondary alignments get a
    // unique synthetic key so they never merge with their primary's chain
    // (cross-region merge + chainIdMap both key on this). Never displayed.
    chainNames.push(chainKey)
    chainSuppTypes[chainIdx] = hasSupp ? (primaryStrand === -1 ? 2 : 1) : 0
    chainPairOrientations[chainIdx] = primaryPairOrientation
    chainHasMultiple[chainIdx] = chain.length >= 2 ? 1 : 0
  }

  return {
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainSuppTypes,
    chainPairOrientations,
    chainHasMultiple,
    chainFirstReadIndices,
    featureIdToChainIdx,
  }
}
