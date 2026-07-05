import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SUPPLEMENTARY,
  splitInversion,
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
  // 0=no supp, 1=supp+primary fwd, 2=supp+primary rev. (The split markers 3
  // (inversion) and 4 (deletion) are applied per-read in the fan-out to BOTH
  // segments of a split mate — see chainMate{0,1}SplitKind below.)
  const chainSuppTypes = new Uint8Array(numChains)
  // Per-mate (read1/read2) split kind: 0=none, 1=inverted (supplementary maps
  // opposite-strand to its own primary — an inversion junction), 2=co-linear
  // (same-strand supplementary — a deletion / tandem-dup junction). Worker-local.
  // The fan-out paints BOTH segments of a split mate the matching color so the
  // split read stands out and which mate split is visible; the normal partner
  // mate keeps its own pair-orientation color.
  const chainMate0SplitKind = new Uint8Array(numChains)
  const chainMate1SplitKind = new Uint8Array(numChains)
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
    let paired = false
    let primaryStrand = 1
    let primaryPairOrientation = 0
    // Each mate's primary strand (a pair has two opposite-strand primaries, so
    // one "primaryStrand" can't frame a supplement). Scalars, not per-chain
    // arrays, to keep this worker loop allocation-free. 0 = no primary seen.
    let mate0Primary = 0
    let mate1Primary = 0
    for (const f of chain) {
      if (f.start < minStart) {
        minStart = f.start
      }
      if (f.end > maxEnd) {
        maxEnd = f.end
      }
      if (f.flags & SAM_FLAG_PAIRED) {
        paired = true
      }
      if (f.flags & SAM_FLAG_SUPPLEMENTARY) {
        hasSupp = true
      } else {
        primaryStrand = f.flags & SAM_FLAG_REVERSE ? -1 : 1
        primaryPairOrientation = f.pairOrientation
        if (f.flags & SAM_FLAG_FIRST_IN_PAIR) {
          mate0Primary = f.strand
        } else {
          mate1Primary = f.strand
        }
      }
      featureIdToChainIdx.set(f.id, chainIdx)
    }
    // Second pass over the (tiny) chain, only when it could matter: classify
    // each mate's split as inverted (opposite-strand supp — via the shared
    // splitInversion classifier, so this can't drift from the arc/connector) or
    // co-linear (same-strand supp — a deletion junction). Inversion is the
    // stronger signal and wins if a mate has both. Primaries are known from pass
    // 1, so segment order is moot.
    let mate0SplitKind = 0
    let mate1SplitKind = 0
    if (paired && hasSupp) {
      for (const f of chain) {
        if (f.flags & SAM_FLAG_SUPPLEMENTARY) {
          const isFirst = (f.flags & SAM_FLAG_FIRST_IN_PAIR) !== 0
          const primary = isFirst ? mate0Primary : mate1Primary
          const kind =
            splitInversion(primary, f.strand) !== undefined
              ? 1
              : primary !== 0 && f.strand !== 0
                ? 2
                : 0
          if (isFirst) {
            mate0SplitKind = kind === 1 ? 1 : mate0SplitKind || kind
          } else {
            mate1SplitKind = kind === 1 ? 1 : mate1SplitKind || kind
          }
        }
      }
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
    chainMate0SplitKind[chainIdx] = mate0SplitKind
    chainMate1SplitKind[chainIdx] = mate1SplitKind
    chainPairOrientations[chainIdx] = primaryPairOrientation
    chainHasMultiple[chainIdx] = chain.length >= 2 ? 1 : 0
  }

  return {
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainSuppTypes,
    chainMate0SplitKind,
    chainMate1SplitKind,
    chainPairOrientations,
    chainHasMultiple,
    chainFirstReadIndices,
    featureIdToChainIdx,
  }
}
