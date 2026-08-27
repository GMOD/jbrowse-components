import { splitJunctionKind } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { groupBy } from '@jbrowse/core/util'

import { chainGroupingKey } from './chainGroupingKey.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_DELETION,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_NONE,
  CHAIN_SUPP_PRESENT,
} from './types.ts'

import type { ReadKey } from './readIdentity.ts'
import type { ChainFeatureData } from './webglRpcTypes.ts'

// This path's encoding of the shared junction classifier: unknown (the primary
// is off-screen, strand 0) means nothing to draw. The result is already a
// `readChainHasSupp` bit, so a mate's several supplementary segments accumulate
// by OR and `chainSplitKind` settles inversion-beats-deletion where it is read —
// there is no third split vocabulary to translate through, and no
// `strongerSplitKind` reducer to keep in step with that precedence.
const SPLIT_KIND_BIT = {
  inversion: CHAIN_SPLIT_INVERSION,
  deletion: CHAIN_SPLIT_DELETION,
}

function classifySplitKind(primaryStrand: number, suppStrand: number) {
  const kind = splitJunctionKind(primaryStrand, suppStrand)
  return kind === undefined ? 0 : SPLIT_KIND_BIT[kind]
}

function isSupplementary(f: ChainFeatureData) {
  return (f.flags & SAM_FLAG_SUPPLEMENTARY) !== 0
}

function isFirstInPair(f: ChainFeatureData) {
  return (f.flags & SAM_FLAG_FIRST_IN_PAIR) !== 0
}

// One pass over a chain's (few) features gathering everything the per-chain
// arrays are written from. `mate0Primary`/`mate1Primary` are each mate's own
// primary strand — a pair has two opposite-strand primaries, so a single
// `primaryStrand` can't frame a supplement against the mate it split from. 0
// means that mate's primary isn't in this chain (off-screen).
function summarizeChain(chain: ChainFeatureData[]) {
  let minStart = Number.POSITIVE_INFINITY
  let maxEnd = Number.NEGATIVE_INFINITY
  let hasSupp = false
  let paired = false
  let primaryStrand = 1
  let primaryPairOrientation = 0
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
    if (isSupplementary(f)) {
      hasSupp = true
    } else {
      // `f.strand` — already normalized by getStrand upstream — not a second
      // derivation from SAM_FLAG_REVERSE, which only a SAM-flavoured source
      // carries. `mate0Primary`/`mate1Primary` below read the same field, so the
      // three can't disagree about which way this primary points.
      primaryStrand = f.strand
      primaryPairOrientation = f.pairOrientation
      if (isFirstInPair(f)) {
        mate0Primary = f.strand
      } else {
        mate1Primary = f.strand
      }
    }
  }
  return {
    minStart,
    maxEnd,
    hasSupp,
    paired,
    primaryStrand,
    primaryPairOrientation,
    mate0Primary,
    mate1Primary,
  }
}

type ChainSummary = ReturnType<typeof summarizeChain>

// Second pass over the (tiny) chain, only when it could matter: classify each
// mate's split against its OWN primary — known from the summary, so segment
// order is moot. A mate with several supplementary segments keeps the strongest
// kind.
function mateSplitKinds(chain: ChainFeatureData[], summary: ChainSummary) {
  let mate0SplitKind = 0
  let mate1SplitKind = 0
  if (summary.paired && summary.hasSupp) {
    for (const f of chain) {
      if (isSupplementary(f)) {
        const isFirst = isFirstInPair(f)
        const kind = classifySplitKind(
          isFirst ? summary.mate0Primary : summary.mate1Primary,
          f.strand,
        )
        if (isFirst) {
          mate0SplitKind |= kind
        } else {
          mate1SplitKind |= kind
        }
      }
    }
  }
  return { mate0SplitKind, mate1SplitKind }
}

/**
 * The has-supplementary and frame bits of `readChainHasSupp` for a chain: absent
 * when it carries no supplementary segment at all, otherwise CHAIN_SUPP_PRESENT
 * plus CHAIN_FRAME_REV when the chain's primary points reverse. For a paired
 * chain (two opposite-strand primaries) `primaryStrand` is whichever was
 * iterated last, but that's fine — the frame is only read on the unpaired branch
 * of the read-fill classifier (colorUtils), where a chain has exactly one
 * primary. Paired chains that DID split OR their per-mate split bits alongside
 * these (see buildChainResultFields); they no longer replace them.
 *
 * `primaryStrand` 0 (no primary in the chain at all) leaves CHAIN_FRAME_REV
 * clear, which `chainFrame` reads as +1 — "we don't know" looks like "not
 * flipped". Exported because a chain can straddle displayed regions and this
 * runs per region: `reconcileChainSuppAcrossRegions` re-answers it from the
 * union, and must encode the answer the same way rather than the same way again.
 *
 * What the worker writes here is a STARTING POINT, not the painted answer.
 * `consensusChainStrandFrames` then re-answers the frame bit on the main thread
 * from all the chains on screen at once, because the primary flag is arbitrary
 * on a foldback — no worker call, seeing one chain, can tell.
 */
export function chainSuppFill(hasSupp: boolean, primaryStrand: number) {
  return hasSupp
    ? CHAIN_SUPP_PRESENT | (primaryStrand === -1 ? CHAIN_FRAME_REV : 0)
    : CHAIN_SUPP_NONE
}

function suppType(summary: ChainSummary) {
  return chainSuppFill(summary.hasSupp, summary.primaryStrand)
}

// How far apart a chain reaches, the key chain layout packs by. Normally the
// genomic span it covers; for a lone read whose mate is elsewhere the span is
// just one read length, so its |TLEN| — the fragment's true reach — is the
// better sort key when the aligner set one.
function chainDistance(chain: ChainFeatureData[], summary: ChainSummary) {
  const soleTlen = chain.length === 1 ? chain[0]!.insertSize : 0
  return soleTlen > 0 ? soleTlen : summary.maxEnd - summary.minStart
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
  // Worker-local: the has-supp and frame bits of readChainHasSupp, ORed into it
  // in the read-array loop. Not part of the result transferred to the main
  // thread.
  const chainSuppTypes = new Uint8Array(numChains)
  // Per-mate (read1/read2) CHAIN_SPLIT_* bits (see classifySplitKind).
  // Worker-local. The fan-out paints BOTH segments of a split mate the matching
  // color so the split read stands out and which mate split is visible; the
  // normal partner mate keeps its own pair-orientation color.
  const chainMate0SplitKind = new Uint8Array(numChains)
  const chainMate1SplitKind = new Uint8Array(numChains)
  // Pair orientation (0=unknown, 1=LR, 2=RL, 3=RR, 4=LL) taken from the chain's
  // primary read, so supplementary segments can inherit the pair's orientation
  // rather than the divergent one their own strand-flipped record computes.
  const chainPairOrientations = new Uint8Array(numChains)
  const chainFirstReadIndices = new Uint32Array(numChains)

  const featureIdToChainIdx = new Map<ReadKey, number>()
  for (let chainIdx = 0; chainIdx < numChains; chainIdx++) {
    const [chainKey, chain] = chainEntries[chainIdx]!
    const summary = summarizeChain(chain)
    const { mate0SplitKind, mate1SplitKind } = mateSplitKinds(chain, summary)
    for (const f of chain) {
      featureIdToChainIdx.set(f.id, chainIdx)
    }
    chainAbsMinStarts[chainIdx] = summary.minStart
    chainAbsMaxEnds[chainIdx] = summary.maxEnd
    chainDistances[chainIdx] = chainDistance(chain, summary)
    // For normal chains this is the QNAME; secondary alignments get a
    // unique synthetic key so they never merge with their primary's chain
    // (cross-region merge + readIdsByChainName both key on this). Never displayed.
    chainNames.push(chainKey)
    chainSuppTypes[chainIdx] = suppType(summary)
    chainMate0SplitKind[chainIdx] = mate0SplitKind
    chainMate1SplitKind[chainIdx] = mate1SplitKind
    chainPairOrientations[chainIdx] = summary.primaryPairOrientation
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
    chainFirstReadIndices,
    featureIdToChainIdx,
  }
}
