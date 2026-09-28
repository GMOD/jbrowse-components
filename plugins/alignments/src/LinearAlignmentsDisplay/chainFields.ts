import {
  readIdAt,
  readNameAt,
  splitJunctionKind,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { chainGroupingKey } from '../shared/chainGroupingKey.ts'
import {
  CHAIN_FRAME_REV,
  CHAIN_SPLIT_DELETION,
  CHAIN_SPLIT_INVERSION,
  CHAIN_SUPP_NONE,
  CHAIN_SUPP_PRESENT,
} from '../shared/types.ts'
import { getOrCreate } from '../shared/util.ts'

import type {
  ChainPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { ReadKeys } from '@jbrowse/alignments-core'

/**
 * Chain identity for the reads of every displayed region, joined on the main
 * thread.
 *
 * A chain is a read: its mates and its split segments, filed by the aligner as
 * separate records that share a QNAME (`chainGroupingKey`). The worker sees one
 * region per call, and a chain crossing a region boundary is exactly the case
 * chain mode exists for, so every answer about a chain is settled here, from
 * the union of what all the regions fetched:
 *
 * - `readChainHasSupp`: whether the chain carries a supplementary segment and
 *   which way its primary points, and for a paired chain how each mate left its
 *   own primary (`CHAIN_SPLIT_*`).
 * - `readPairOrientations`: a supplementary segment's own record computes a
 *   divergent orientation (its strand flips at the split junction), so it takes
 *   its primary's, wherever that primary landed. Copy-on-write, so a region
 *   with nothing to correct keeps the worker's array.
 *
 * The union is by NAME across every lane as well as every region: a region that
 * holds only a supplementary files it under the supplementary's own facet value
 * (`chainRepresentative` falls back to it), so a per-lane union could never
 * meet that segment's primary.
 *
 * The per-region pass — keying reads, numbering chains, their bounds and packing
 * distance — is memoized on `readKeys` identity, which is the region's fetched
 * data whatever object wraps it (`buildRawDataByGroup` re-spreads a region when
 * a band is pinned). A region landing costs its own reads; the rest are hits.
 *
 * Two deviations from the worker's earlier chain numbering are accepted: chains
 * come out in first-seen order rather than integer-keys-first, which moves only
 * the overflow-row hit tie-break and the connecting lines' emission order (the
 * layout's sort is total), and a sole read's packing distance comes off the
 * Float32 |TLEN|, which can reorder packing ties above 2^24 bp.
 */

// A supplementary segment's strand, for the per-mate split classification —
// the two strands a junction can be classified against, kept as a set so a
// mate's several segments fold by OR.
const SUPP_FWD = 1
const SUPP_REV = 2

// What a region's segments say about one chain, folded into the union across
// regions by `foldSummary`. `primaryRank` orders which primary answers for the
// chain's frame and pair orientation: the first-in-pair primary, else any
// primary, else none (0), so the answer does not depend on which region landed
// first.
interface ChainSummary {
  hasSupp: boolean
  paired: boolean
  primaryRank: number
  primaryStrand: number
  primaryPairOrientation: number
  mate0Primary: number
  mate1Primary: number
  mate0SuppStrands: number
  mate1SuppStrands: number
}

// One chain across every region and lane, with the per-read answers resolved.
interface ChainUnion extends ChainSummary {
  fill: number
  mate0SplitKind: number
  mate1SplitKind: number
}

interface RegionChains {
  readChainIndices: Uint32Array
  chainNames: string[]
  chainAbsMinStarts: Uint32Array
  chainAbsMaxEnds: Uint32Array
  chainDistances: Uint32Array
  chainFirstReadIndices: Uint32Array
  summaries: ChainSummary[]
  // Chain index → the ids of its reads here. Built on first request: the
  // hover highlight is the only reader, and each id is a string per read.
  readIdsByChain: string[][] | undefined
}

const regionChainsCache = new WeakMap<ReadKeys, RegionChains>()

function regionChainsOf(data: WorkerPileupData) {
  let chains = regionChainsCache.get(data.readKeys)
  if (!chains) {
    chains = buildRegionChains(data)
    regionChainsCache.set(data.readKeys, chains)
  }
  return chains
}

function emptySummary(): ChainSummary {
  return {
    hasSupp: false,
    paired: false,
    primaryRank: 0,
    primaryStrand: 0,
    primaryPairOrientation: 0,
    mate0Primary: 0,
    mate1Primary: 0,
    mate0SuppStrands: 0,
    mate1SuppStrands: 0,
  }
}

function addRead(
  s: ChainSummary,
  flags: number,
  strand: number,
  pairOrientation: number,
) {
  const first = (flags & SAM_FLAG_FIRST_IN_PAIR) !== 0
  if (flags & SAM_FLAG_PAIRED) {
    s.paired = true
  }
  if (flags & SAM_FLAG_SUPPLEMENTARY) {
    s.hasSupp = true
    const bit = strand === -1 ? SUPP_REV : strand === 1 ? SUPP_FWD : 0
    if (first) {
      s.mate0SuppStrands |= bit
    } else {
      s.mate1SuppStrands |= bit
    }
    return
  }
  const rank = first ? 2 : 1
  if (rank > s.primaryRank) {
    s.primaryRank = rank
    s.primaryStrand = strand
    s.primaryPairOrientation = pairOrientation
  }
  if (first) {
    s.mate0Primary = strand
  } else {
    s.mate1Primary = strand
  }
}

function foldSummary(into: ChainSummary, from: ChainSummary) {
  into.hasSupp ||= from.hasSupp
  into.paired ||= from.paired
  if (from.primaryRank > into.primaryRank) {
    into.primaryRank = from.primaryRank
    into.primaryStrand = from.primaryStrand
    into.primaryPairOrientation = from.primaryPairOrientation
  }
  into.mate0Primary ||= from.mate0Primary
  into.mate1Primary ||= from.mate1Primary
  into.mate0SuppStrands |= from.mate0SuppStrands
  into.mate1SuppStrands |= from.mate1SuppStrands
}

function buildRegionChains(data: WorkerPileupData): RegionChains {
  const {
    readKeys,
    readFlags,
    readStrands,
    readPositions,
    readInsertSizes,
    readPairOrientations,
  } = data
  const numReads = readKeys.length
  const readChainIndices = new Uint32Array(numReads)
  const chainNames: string[] = []
  const indexByName = new Map<string, number>()
  const summaries: ChainSummary[] = []
  const minStarts: number[] = []
  const maxEnds: number[] = []
  const firstReads: number[] = []
  const readCounts: number[] = []
  for (let i = 0; i < numReads; i++) {
    const flags = readFlags[i]!
    const name = chainGroupingKey(readNameAt(data, i), readKeys[i]!, flags)
    const start = readPositions[i * 2]!
    const end = readPositions[i * 2 + 1]!
    let c = indexByName.get(name)
    if (c === undefined) {
      c = chainNames.length
      indexByName.set(name, c)
      chainNames.push(name)
      summaries.push(emptySummary())
      minStarts.push(start)
      maxEnds.push(end)
      firstReads.push(i)
      readCounts.push(0)
    } else {
      if (start < minStarts[c]!) {
        minStarts[c] = start
      }
      if (end > maxEnds[c]!) {
        maxEnds[c] = end
      }
    }
    readCounts[c]!++
    readChainIndices[i] = c
    addRead(summaries[c]!, flags, readStrands[i]!, readPairOrientations[i]!)
  }

  const numChains = chainNames.length
  const chainDistances = new Uint32Array(numChains)
  for (let c = 0; c < numChains; c++) {
    // How far the chain reaches, the key the layout packs by: its span here,
    // except that a lone read's span is one read length, so its |TLEN| — the
    // fragment's true reach — is the better key when the aligner set one.
    const soleTlen = readCounts[c] === 1 ? readInsertSizes[firstReads[c]!]! : 0
    chainDistances[c] = soleTlen > 0 ? soleTlen : maxEnds[c]! - minStarts[c]!
  }
  return {
    readChainIndices,
    chainNames,
    chainAbsMinStarts: Uint32Array.from(minStarts),
    chainAbsMaxEnds: Uint32Array.from(maxEnds),
    chainDistances,
    chainFirstReadIndices: Uint32Array.from(firstReads),
    summaries,
    readIdsByChain: undefined,
  }
}

// The has-supplementary and frame bits of `readChainHasSupp`: absent when the
// chain carries no supplementary segment, otherwise present plus the frame
// when the primary points reverse. A primary nobody fetched (strand 0) leaves
// the frame clear, which reads as +1. What is written here is a starting point:
// `consensusChainStrandFrames` re-answers the frame from the other chains on
// screen, because on a foldback the primary flag is arbitrary.
function chainSuppFill(hasSupp: boolean, primaryStrand: number) {
  return hasSupp
    ? CHAIN_SUPP_PRESENT | (primaryStrand === -1 ? CHAIN_FRAME_REV : 0)
    : CHAIN_SUPP_NONE
}

const SPLIT_KIND_BIT = {
  inversion: CHAIN_SPLIT_INVERSION,
  deletion: CHAIN_SPLIT_DELETION,
}

function splitKindBit(primaryStrand: number, suppStrand: number) {
  const kind = splitJunctionKind(primaryStrand, suppStrand)
  return kind === undefined ? 0 : SPLIT_KIND_BIT[kind]
}

// A mate's split against its OWN primary, over every supplementary segment the
// mate has anywhere on screen. A mate with several keeps them all as bits;
// `chainSplitKind` settles inversion-beats-deletion where it is read.
function mateSplitKind(primaryStrand: number, suppStrands: number) {
  return (
    (suppStrands & SUPP_FWD ? splitKindBit(primaryStrand, 1) : 0) |
    (suppStrands & SUPP_REV ? splitKindBit(primaryStrand, -1) : 0)
  )
}

function resolveUnion(s: ChainSummary): ChainUnion {
  const split = s.paired && s.hasSupp
  return {
    ...s,
    fill: chainSuppFill(s.hasSupp, s.primaryStrand),
    mate0SplitKind: split
      ? mateSplitKind(s.mate0Primary, s.mate0SuppStrands)
      : 0,
    mate1SplitKind: split
      ? mateSplitKind(s.mate1Primary, s.mate1SuppStrands)
      : 0,
  }
}

function attachRegion(
  data: WorkerPileupData,
  chains: RegionChains,
  unionOf: ChainUnion[],
): ChainPileupData {
  const { readFlags, readPairOrientations } = data
  const { readChainIndices } = chains
  const numReads = readChainIndices.length
  const readChainHasSupp = new Uint8Array(numReads)
  let corrected: Uint8Array | undefined
  for (let i = 0; i < numReads; i++) {
    const u = unionOf[readChainIndices[i]!]!
    const flags = readFlags[i]!
    // Split bits are per MATE, so both segments of a split mate stand out and
    // the normal partner keeps its pair colour; ORed onto the chain's bits, the
    // two describing different units.
    const split =
      flags & SAM_FLAG_FIRST_IN_PAIR ? u.mate0SplitKind : u.mate1SplitKind
    readChainHasSupp[i] = u.fill | split
    if (
      flags & SAM_FLAG_SUPPLEMENTARY &&
      u.primaryPairOrientation > 0 &&
      readPairOrientations[i] !== u.primaryPairOrientation
    ) {
      corrected ??= new Uint8Array(readPairOrientations)
      corrected[i] = u.primaryPairOrientation
    }
  }
  return {
    ...data,
    readChainIndices,
    chainNames: chains.chainNames,
    chainAbsMinStarts: chains.chainAbsMinStarts,
    chainAbsMaxEnds: chains.chainAbsMaxEnds,
    chainDistances: chains.chainDistances,
    chainFirstReadIndices: chains.chainFirstReadIndices,
    readChainHasSupp,
    ...(corrected && { readPairOrientations: corrected }),
  }
}

export type ChainedByGroup = ReadonlyMap<
  string,
  ReadonlyMap<number, ChainPileupData>
>

/**
 * Every lane's regions with chain identity attached — see the module header.
 * The input is `rawDataByGroup`, already reduced to the visible lanes.
 */
export function attachChainFields(
  rawByGroup: ReadonlyMap<string, ReadonlyMap<number, WorkerPileupData>>,
): ChainedByGroup {
  const union = new Map<string, ChainSummary>()
  for (const regions of rawByGroup.values()) {
    for (const data of regions.values()) {
      const { chainNames, summaries } = regionChainsOf(data)
      for (let c = 0; c < chainNames.length; c++) {
        const seen = union.get(chainNames[c]!)
        if (seen) {
          foldSummary(seen, summaries[c]!)
        } else {
          union.set(chainNames[c]!, { ...summaries[c]! })
        }
      }
    }
  }
  const resolved = new Map<string, ChainUnion>()
  for (const [name, summary] of union) {
    resolved.set(name, resolveUnion(summary))
  }

  const out = new Map<string, Map<number, ChainPileupData>>()
  for (const [key, regions] of rawByGroup) {
    const chained = new Map<number, ChainPileupData>()
    for (const [idx, data] of regions) {
      const chains = regionChainsOf(data)
      chained.set(
        idx,
        attachRegion(
          data,
          chains,
          chains.chainNames.map(name => resolved.get(name)!),
        ),
      )
    }
    out.set(key, chained)
  }
  return out
}

function readIdsByChainOf(data: ChainPileupData) {
  const chains = regionChainsOf(data)
  if (!chains.readIdsByChain) {
    const { readChainIndices, chainNames } = data
    const ids: string[][] = Array.from({ length: chainNames.length }, () => [])
    for (let i = 0; i < readChainIndices.length; i++) {
      const id = readIdAt(data, i)
      if (id !== undefined) {
        ids[readChainIndices[i]!]!.push(id)
      }
    }
    chains.readIdsByChain = ids
  }
  return chains.readIdsByChain
}

/**
 * Chain name → the ids of its reads across every lane and region, for the
 * hover and selection highlight (`chainReadIdsAt`). Keyed by name, since chain
 * indices are numbered per region and per lane.
 */
export function buildReadIdsByChainName(byGroup: ChainedByGroup) {
  const map = new Map<string, string[]>()
  for (const regions of byGroup.values()) {
    for (const data of regions.values()) {
      const ids = readIdsByChainOf(data)
      for (let c = 0; c < ids.length; c++) {
        getOrCreate(map, data.chainNames[c]!, () => []).push(...ids[c]!)
      }
    }
  }
  return map
}
