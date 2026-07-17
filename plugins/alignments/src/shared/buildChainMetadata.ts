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

// How a mate's supplementary segment splits away from its own primary. Kept as a
// worker-local classification (the read-fill markers it maps to live in
// buildChainResultFields); exported so that mapping can name the cases it reads.
export const SPLIT_NONE = 0
export const SPLIT_INVERSION = 1
export const SPLIT_DELETION = 2

// Classify one supplementary segment against its primary mate's strand:
// opposite strand = an inversion junction; same known strand = a co-linear
// deletion / tandem-dup junction; unknown (the primary is off-screen, strand 0)
// = nothing to draw. Uses the shared splitInversion classifier so this can't
// drift from the arc/connector coloring.
function classifySplitKind(primaryStrand: number, suppStrand: number) {
  if (splitInversion(primaryStrand, suppStrand) !== undefined) {
    return SPLIT_INVERSION
  }
  return primaryStrand !== 0 && suppStrand !== 0 ? SPLIT_DELETION : SPLIT_NONE
}

// A mate can carry several supplementary segments; inversion is the stronger
// signal and wins over a plain deletion, which in turn wins over none.
function strongerSplitKind(a: number, b: number) {
  return a === SPLIT_INVERSION || b === SPLIT_INVERSION
    ? SPLIT_INVERSION
    : Math.max(a, b)
}

/**
 * Group chain features by name and compute per-chain metadata used by the
 * main-thread layout. Returns the chain-keyed TypedArrays plus a worker-local
 * map (`featureIdToChainIdx`) the read-array loop uses to attach reads to
 * chains. `chainFirstReadIndices` is allocated zero-filled — the caller fills
 * it during the read-array pass, since it indexes into the read arrays.
 *
 * Insert-size stats are NOT computed here: they describe the whole region's
 * read set, not one group, so the worker entry computes one shared scale across
 * all groups (see computePairedInsertSizeStats).
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
  // Per-mate (read1/read2) split kind (SPLIT_NONE/INVERSION/DELETION, see
  // classifySplitKind). Worker-local. The fan-out paints BOTH segments of a
  // split mate the matching color so the split read stands out and which mate
  // split is visible; the normal partner mate keeps its own pair-orientation
  // color.
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
    // each mate's split against its own primary (known from pass 1, so segment
    // order is moot). A mate with several supplementary segments keeps the
    // strongest kind.
    let mate0SplitKind = SPLIT_NONE
    let mate1SplitKind = SPLIT_NONE
    if (paired && hasSupp) {
      for (const f of chain) {
        if (f.flags & SAM_FLAG_SUPPLEMENTARY) {
          const isFirst = (f.flags & SAM_FLAG_FIRST_IN_PAIR) !== 0
          const kind = classifySplitKind(
            isFirst ? mate0Primary : mate1Primary,
            f.strand,
          )
          if (isFirst) {
            mate0SplitKind = strongerSplitKind(mate0SplitKind, kind)
          } else {
            mate1SplitKind = strongerSplitKind(mate1SplitKind, kind)
          }
        }
      }
    }
    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = chain[0]!.insertSize
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
    // 1=fwd primary, 2=rev primary. For a paired chain (two opposite-strand
    // primaries) this is whichever was iterated last, but that's fine: the fwd-
    // vs-rev (1-vs-2) distinction is only read on the unpaired branch of the
    // read-fill classifier (colorUtils), where a chain has exactly one primary.
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
