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
 * distance, and the answer the region gives alone — is memoized on `readKeys`
 * identity, which is the region's fetched data whatever object wraps it
 * (`buildRawDataByGroup` re-spreads a region when a band is pinned). A landing
 * then costs the new region's reads, one name lookup per chain on screen to
 * find the chains two regions share, and the reads of those chains alone.
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

// `ChainSummaries.bits`: the chain carries a supplementary, is paired, and each
// mate's supplementary strands (two bits each).
const HAS_SUPP = 1
const PAIRED = 2
const MATE0_SUPP_SHIFT = 2
const MATE1_SUPP_SHIFT = 4

// What a region's segments say about each of its chains, a slot per chain.
// Arrays rather than an object per chain, since at depth most chains are plain
// pairs whose answer is zero, and the objects were the larger part of a
// region's cost. `primaryRank` orders which primary answers for the chain's
// frame and pair orientation: the first-in-pair primary, else any primary,
// else none (0), so the answer does not depend on which region landed first.
interface ChainSummaries {
  bits: Uint8Array
  primaryRank: Uint8Array
  primaryStrand: Int8Array
  primaryPairOrientation: Uint8Array
  mate0Primary: Int8Array
  mate1Primary: Int8Array
}

// One chain's slot as an object, for the chains more than one region holds,
// which `foldSummary` unions.
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

// The two per-read answers the union settles.
interface ReadAnswers {
  readChainHasSupp: Uint8Array
  readPairOrientations: Uint8Array
}

interface RegionChains {
  readChainIndices: Uint32Array
  chainNames: string[]
  chainAbsMinStarts: Uint32Array
  chainAbsMaxEnds: Uint32Array
  chainDistances: Uint32Array
  chainFirstReadIndices: Uint32Array
  summaries: ChainSummaries
  // The region's answers when no other region shares one of its chains, which
  // is the whole answer for most regions and the base the rest copy from.
  alone: ReadAnswers | undefined
  // The attached region built from `alone`, reused while the same object wraps
  // the region, so a region sharing no chain keeps its identity across landings.
  aloneAttached: { source: WorkerPileupData; out: ChainPileupData } | undefined
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

function addRead(
  s: ChainSummaries,
  c: number,
  flags: number,
  strand: number,
  pairOrientation: number,
) {
  const first = (flags & SAM_FLAG_FIRST_IN_PAIR) !== 0
  if (flags & SAM_FLAG_PAIRED) {
    s.bits[c]! |= PAIRED
  }
  if (flags & SAM_FLAG_SUPPLEMENTARY) {
    const bit = strand === -1 ? SUPP_REV : strand === 1 ? SUPP_FWD : 0
    s.bits[c]! |=
      HAS_SUPP | (bit << (first ? MATE0_SUPP_SHIFT : MATE1_SUPP_SHIFT))
    return
  }
  const rank = first ? 2 : 1
  if (rank > s.primaryRank[c]!) {
    s.primaryRank[c] = rank
    s.primaryStrand[c] = strand
    s.primaryPairOrientation[c] = pairOrientation
  }
  if (first) {
    s.mate0Primary[c] = strand
  } else {
    s.mate1Primary[c] = strand
  }
}

function summaryAt(s: ChainSummaries, c: number): ChainSummary {
  const bits = s.bits[c]!
  return {
    hasSupp: (bits & HAS_SUPP) !== 0,
    paired: (bits & PAIRED) !== 0,
    primaryRank: s.primaryRank[c]!,
    primaryStrand: s.primaryStrand[c]!,
    primaryPairOrientation: s.primaryPairOrientation[c]!,
    mate0Primary: s.mate0Primary[c]!,
    mate1Primary: s.mate1Primary[c]!,
    mate0SuppStrands: (bits >> MATE0_SUPP_SHIFT) & 3,
    mate1SuppStrands: (bits >> MATE1_SUPP_SHIFT) & 3,
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
  // Sized for one chain per read, the most a region can hold.
  const summaries: ChainSummaries = {
    bits: new Uint8Array(numReads),
    primaryRank: new Uint8Array(numReads),
    primaryStrand: new Int8Array(numReads),
    primaryPairOrientation: new Uint8Array(numReads),
    mate0Primary: new Int8Array(numReads),
    mate1Primary: new Int8Array(numReads),
  }
  const minStarts = new Uint32Array(numReads)
  const maxEnds = new Uint32Array(numReads)
  const firstReads = new Uint32Array(numReads)
  const readCounts = new Uint32Array(numReads)
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
      minStarts[c] = start
      maxEnds[c] = end
      firstReads[c] = i
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
    addRead(summaries, c, flags, readStrands[i]!, readPairOrientations[i]!)
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
    chainAbsMinStarts: minStarts.slice(0, numChains),
    chainAbsMaxEnds: maxEnds.slice(0, numChains),
    chainDistances,
    chainFirstReadIndices: firstReads.slice(0, numChains),
    summaries,
    alone: undefined,
    aloneAttached: undefined,
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

// Split bits are per MATE, so both segments of a split mate stand out and the
// normal partner keeps its pair colour; ORed onto the chain's bits, the two
// describing different units.
function readFill(u: ChainUnion, flags: number) {
  return (
    u.fill |
    (flags & SAM_FLAG_FIRST_IN_PAIR ? u.mate0SplitKind : u.mate1SplitKind)
  )
}

function readOrientation(u: ChainUnion, flags: number, own: number) {
  return flags & SAM_FLAG_SUPPLEMENTARY && u.primaryPairOrientation > 0
    ? u.primaryPairOrientation
    : own
}

// A chain with no supplementary answers zero and keeps its orientations, so
// only the chains carrying one are resolved.
function aloneAnswers(data: WorkerPileupData, chains: RegionChains) {
  if (!chains.alone) {
    const { readFlags, readPairOrientations } = data
    const { readChainIndices, summaries } = chains
    const unions: ChainUnion[] = []
    const readChainHasSupp = new Uint8Array(readChainIndices.length)
    let corrected: Uint8Array | undefined
    for (let i = 0; i < readChainIndices.length; i++) {
      const c = readChainIndices[i]!
      if (!(summaries.bits[c]! & HAS_SUPP)) {
        continue
      }
      const u = (unions[c] ??= resolveUnion(summaryAt(summaries, c)))
      const flags = readFlags[i]!
      readChainHasSupp[i] = readFill(u, flags)
      const own = readPairOrientations[i]!
      const o = readOrientation(u, flags, own)
      if (o !== own) {
        corrected ??= new Uint8Array(readPairOrientations)
        corrected[i] = o
      }
    }
    chains.alone = {
      readChainHasSupp,
      readPairOrientations: corrected ?? readPairOrientations,
    }
  }
  return chains.alone
}

// `alone` with the reads of the shared chains re-answered from the union.
function sharedAnswers(
  data: WorkerPileupData,
  chains: RegionChains,
  sharedUnions: readonly (ChainUnion | undefined)[],
): ReadAnswers {
  const alone = aloneAnswers(data, chains)
  const { readFlags, readPairOrientations } = data
  const { readChainIndices } = chains
  const readChainHasSupp = new Uint8Array(alone.readChainHasSupp)
  let corrected: Uint8Array | undefined
  for (let i = 0; i < readChainIndices.length; i++) {
    const u = sharedUnions[readChainIndices[i]!]
    if (u) {
      const flags = readFlags[i]!
      readChainHasSupp[i] = readFill(u, flags)
      const o = readOrientation(u, flags, readPairOrientations[i]!)
      if (o !== alone.readPairOrientations[i]) {
        corrected ??= new Uint8Array(alone.readPairOrientations)
        corrected[i] = o
      }
    }
  }
  return {
    readChainHasSupp,
    readPairOrientations: corrected ?? alone.readPairOrientations,
  }
}

function attached(
  data: WorkerPileupData,
  chains: RegionChains,
  answers: ReadAnswers,
): ChainPileupData {
  return {
    ...data,
    readChainIndices: chains.readChainIndices,
    chainNames: chains.chainNames,
    chainAbsMinStarts: chains.chainAbsMinStarts,
    chainAbsMaxEnds: chains.chainAbsMaxEnds,
    chainDistances: chains.chainDistances,
    chainFirstReadIndices: chains.chainFirstReadIndices,
    ...answers,
  }
}

function attachedAlone(data: WorkerPileupData, chains: RegionChains) {
  if (chains.aloneAttached?.source !== data) {
    chains.aloneAttached = {
      source: data,
      out: attached(data, chains, aloneAnswers(data, chains)),
    }
  }
  return chains.aloneAttached.out
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
  const entries: { key: string; idx: number; data: WorkerPileupData }[] = []
  const chainsOf: RegionChains[] = []
  const offsets: number[] = []
  let numChains = 0
  for (const [key, regions] of rawByGroup) {
    for (const [idx, data] of regions) {
      const chains = regionChainsOf(data)
      entries.push({ key, idx, data })
      chainsOf.push(chains)
      offsets.push(numChains)
      numChains += chains.chainNames.length
    }
  }

  // Which chains more than one entry holds. A chain's first sighting is noted
  // by its ordinal across every entry, a small integer, so the map holds no
  // object per chain.
  const shared = new Uint8Array(numChains)
  const firstSeen = new Map<string, number>()
  let anyShared = false
  if (entries.length > 1) {
    for (let e = 0; e < entries.length; e++) {
      const names = chainsOf[e]!.chainNames
      const base = offsets[e]!
      for (let c = 0; c < names.length; c++) {
        const prev = firstSeen.get(names[c]!)
        if (prev === undefined) {
          firstSeen.set(names[c]!, base + c)
        } else {
          shared[prev] = 1
          shared[base + c] = 1
          anyShared = true
        }
      }
    }
  }

  const folded = new Map<string, ChainSummary>()
  if (anyShared) {
    for (let e = 0; e < entries.length; e++) {
      const { chainNames, summaries } = chainsOf[e]!
      const base = offsets[e]!
      for (let c = 0; c < chainNames.length; c++) {
        if (shared[base + c]) {
          const seen = folded.get(chainNames[c]!)
          if (seen) {
            foldSummary(seen, summaryAt(summaries, c))
          } else {
            folded.set(chainNames[c]!, summaryAt(summaries, c))
          }
        }
      }
    }
  }
  const resolved = new Map<string, ChainUnion>()
  for (const [name, summary] of folded) {
    resolved.set(name, resolveUnion(summary))
  }

  const out = new Map<string, Map<number, ChainPileupData>>()
  for (let e = 0; e < entries.length; e++) {
    const { key, idx, data } = entries[e]!
    const chains = chainsOf[e]!
    const base = offsets[e]!
    let sharedUnions: (ChainUnion | undefined)[] | undefined
    for (let c = 0; c < chains.chainNames.length; c++) {
      if (shared[base + c]) {
        sharedUnions ??= []
        sharedUnions[c] = resolved.get(chains.chainNames[c]!)
      }
    }
    getOrCreate(out, key, () => new Map()).set(
      idx,
      sharedUnions
        ? attached(data, chains, sharedAnswers(data, chains, sharedUnions))
        : attachedAlone(data, chains),
    )
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
