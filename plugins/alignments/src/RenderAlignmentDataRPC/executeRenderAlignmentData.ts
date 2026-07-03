import { SAM_FLAG_SUPPLEMENTARY } from '@jbrowse/alignments-core'
import {
  createProgressReporter,
  groupBy,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import {
  buildBaseFeatureData,
  buildChainFeatureData,
} from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildChainMetadata } from '../shared/buildChainMetadata.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { chainGroupingKey } from '../shared/chainGroupingKey.ts'
import { collectGroupedTransferables } from '../shared/collectTransferables.ts'
import { isModificationScheme } from '../shared/colorSchemes.ts'
import {
  computeChainInsertSizeStats,
  computePairedInsertSizeStats,
} from '../shared/computePairedInsertSizeStats.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import {
  isChainGroupableType,
  partitionChains,
  partitionFeatures,
} from '../shared/groupFeatures.ts'
import { buildReadInterchrom } from '../shared/readInterchrom.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'

import type {
  AlignmentGroup,
  PileupDataResult,
  RenderAlignmentDataArgs,
} from './types.ts'
import type { StrandBaseCounts } from '../shared/calculateModificationCounts.ts'
import type { ChainFeatureData } from '../shared/webglRpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

// A pair is only "proper" when its mates have the normal FR orientation
// (F1R2 / F2R1). Discordant orientations (RL, RR, LL) signal structural
// variants and stay visible even when proper pairs are hidden, regardless of
// whether the aligner set the 0x2 flag.
function isConcordantOrientation(f: Feature) {
  const orientation = f.get('pair_orientation') as string | undefined
  return (
    orientation === undefined ||
    orientation === 'F1R2' ||
    orientation === 'F2R1'
  )
}

// A chain counts as a proper pair only when every read carries the 0x2 flag
// and has a concordant orientation.
function isProperPairChain(chain: Feature[]) {
  return chain.every(
    (f: Feature) =>
      !!(((f.get('flags') as number | undefined) ?? 0) & 2) &&
      isConcordantOrientation(f),
  )
}

// Guard against the same physical record being emitted twice — rare, only when
// overlapping BAM index chunks re-decode one read; a dup would double-count
// coverage depth and double-draw. `id()` (`${adapter}-${fileOffset}`) is unique
// per record. In the overwhelmingly common no-dup case this returns the input
// array untouched, so the guard costs one Set build, not a full-length copy of
// every feature (matters at ultra-deep coverage — hundreds of thousands).
function dedupeById(features: Feature[]) {
  const seen = new Set<string>()
  let dupIndex = -1
  for (let i = 0; i < features.length; i++) {
    const id = features[i]!.id()
    if (seen.has(id)) {
      dupIndex = i
      break
    }
    seen.add(id)
  }
  if (dupIndex === -1) {
    return features
  }
  // A dup exists: keep the unique prefix, then continue skipping repeats.
  const out = features.slice(0, dupIndex)
  for (let i = dupIndex; i < features.length; i++) {
    const f = features[i]!
    const id = f.id()
    if (!seen.has(id)) {
      seen.add(id)
      out.push(f)
    }
  }
  return out
}

// Chain mode groups reads into chains by name, then optionally drops
// singletons (chains of one) and proper pairs.
export function filterChainFeatures(
  features: Feature[],
  drawSingletons: boolean,
  drawProperPairs: boolean,
) {
  const deduped = dedupeById(features)
  if (drawSingletons && drawProperPairs) {
    return deduped
  }
  const byChain = groupBy(deduped, (f: Feature) =>
    chainGroupingKey(
      f.get('name') ?? '',
      f.id(),
      (f.get('flags') as number | undefined) ?? 0,
    ),
  )
  let rawChains = Object.values(byChain)
  if (!drawSingletons) {
    rawChains = rawChains.filter(c => c.length > 1)
  }
  if (!drawProperPairs) {
    rawChains = rawChains.filter(c => !isProperPairChain(c))
  }
  const keptIds = new Set<string>()
  for (const chain of rawChains) {
    for (const f of chain) {
      keptIds.add(f.id())
    }
  }
  return deduped.filter(f => keptIds.has(f.id()))
}

// Chain metadata + the per-read arrays linking each read back to its chain.
// `readPairOrientations` (already built by buildBaseReadArrays) is corrected in
// place: a supplementary segment's own record computes a divergent orientation
// (its strand is flipped at the split junction), so under the pairOrientation
// scheme it would color as the normal LR grey instead of the pair's abnormal
// RR/LL hue. Inheriting the chain primary's orientation makes the whole read
// pair color consistently — the fix flows to the GPU (pairOrient attribute),
// the Canvas2D/legend path, and the tooltip alike, since all read the corrected
// array.
function buildChainResultFields(
  features: ChainFeatureData[],
  readPairOrientations: Uint8Array,
): Partial<PileupDataResult> {
  const {
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainSuppTypes,
    chainPairOrientations,
    chainHasMultiple,
    chainFirstReadIndices,
    featureIdToChainIdx,
  } = buildChainMetadata(features)
  const numChains = chainNames.length

  const readChainHasSupp = new Uint8Array(features.length)
  const readChainIndices = new Uint32Array(features.length)
  const readNextRefs: string[] = []
  const chainFirstReadSeen = new Uint8Array(numChains)
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const cIdx = featureIdToChainIdx.get(f.id) ?? 0
    readChainHasSupp[i] = chainSuppTypes[cIdx]!
    readChainIndices[i] = cIdx
    readNextRefs.push(f.nextRef ?? '')
    // Only overwrite when the chain's primary (paired) read set an orientation;
    // a supplementary whose primary is in another region keeps its own value.
    if (f.flags & SAM_FLAG_SUPPLEMENTARY && chainPairOrientations[cIdx]! > 0) {
      readPairOrientations[i] = chainPairOrientations[cIdx]!
    }
    if (!chainFirstReadSeen[cIdx]) {
      chainFirstReadSeen[cIdx] = 1
      chainFirstReadIndices[cIdx] = i
    }
  }
  return {
    readChainHasSupp,
    readChainIndices,
    readNextRefs,
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainHasMultiple,
    chainFirstReadIndices,
  }
}

// Per-group context shared across every section of one fetch. The region
// sequence, simplex-modification set, and color/softclip flags are global to
// the fetch (not the group) — resolving them once keeps modification coloring
// identical in every section.
interface GroupContext {
  isChain: boolean
  region: Region
  effShowSoftClipping: boolean
  trackStrands: boolean
  detectedSimplexModifications: ReadonlySet<string>
  // Shared insert-size color scale, pooled across every group of the fetch so
  // all stacked sections color long/short inserts on one comparable scale.
  insertSizeStats: { upper: number; lower: number } | undefined
  statusCallback: StatusCallback
  stopTokenCheck: StopTokenChecker
}

// The shared spine for one group's reads: per-read/gap/mismatch arrays,
// coverage pipeline, result assembly. Identical for grouped and ungrouped
// fetches — ungrouped is just the one-group case.
async function buildGroupResult(
  extraction: ReturnType<typeof extractFeatureArrays>,
  // Raw reads for this group, needed to tally per-strand read bases at modified
  // positions (the reference-free mod-coverage denominator).
  rawFeatures: Feature[],
  ctx: GroupContext,
): Promise<PileupDataResult> {
  const {
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    perBaseQualities,
    perBaseLetters,
    tagColorValues,
    sortTagValues,
    uniqueTagValues,
    nextRefs,
    nextPositions,
    suppAlignments,
    clipAtStart,
    detectedModifications,
  } = extraction
  const {
    isChain,
    region,
    effShowSoftClipping,
    trackStrands,
    detectedSimplexModifications,
    insertSizeStats,
    statusCallback,
    stopTokenCheck,
  } = ctx

  // Layout (readYs/gapYs/mismatchYs/etc.) is computed on the main thread via
  // `laidOutPileupMap` (pileup) / `computeChainLayout` (chain) — the worker
  // emits zero-filled Y arrays.
  const { readArrays } = buildBaseReadArrays(features, region.start)

  // `isChain` implies the chain builder ran, so `features` are ChainFeatureData.
  const chainFields: Partial<PileupDataResult> = isChain
    ? buildChainResultFields(
        features as ChainFeatureData[],
        readArrays.readPairOrientations,
      )
    : {
        readNextRefs: nextRefs,
        sortTagValues,
      }

  const {
    gapArrays,
    mismatchArrays,
    softclipBaseArrays,
    interbaseArrays,
    modificationArrays,
    perBaseQualityArrays,
    perBaseLetterArrays,
    segmentArrays,
  } = await buildAlignmentDetailArrays({
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    perBaseQualities,
    perBaseLetters,
    detectedModifications,
    region,
    showSoftClipping: effShowSoftClipping,
    statusCallback,
  })

  checkStopToken2(stopTokenCheck)

  // IGV-style per-strand read-base pileup at the modified columns, computed from
  // the reads themselves — the mod-coverage denominator, no reference needed.
  // Only the modification color modes (trackStrands) draw mod coverage.
  const modBaseCounts = trackStrands
    ? computeReadBaseCounts(
        rawFeatures,
        new Set(modifications.map(m => m.position)),
      )
    : new Map<number, StrandBaseCounts>()

  const pipeline = await runCoveragePipeline({
    features,
    gaps,
    insertions,
    softclips,
    hardclips,
    modifications,
    modBaseCounts,
    simplexModifications: detectedSimplexModifications,
    region,
    mismatchArrays,
    interbaseArrays,
    gapArrays,
    trackStrands,
    statusCallback,
    stopTokenCheck,
  })

  // Derived here where both branches' readNextRefs and the region refName are in
  // scope, rather than threaded through the array builders.
  const readInterchrom = buildReadInterchrom(
    chainFields.readNextRefs,
    region.refName,
    features.length,
  )

  return {
    ...readArrays,
    readInterchrom,
    ...segmentArrays,
    ...gapArrays,
    gapFrequencies: pipeline.gapFrequencies,
    ...mismatchArrays,
    mismatchFrequencies: pipeline.mismatchFrequencies,
    ...softclipBaseArrays,
    ...interbaseArrays,
    interbaseFrequencies: pipeline.interbaseFrequencies,
    ...modificationArrays,
    ...perBaseQualityArrays,
    ...perBaseLetterArrays,

    // Worker leaves readTagColors empty; the main thread bakes it from
    // readTagValues + colorTagMap (see overlayReadTagColors).
    readTagColors: new Uint32Array(0),
    readTagValues: tagColorValues,

    ...buildCoverageResultFields(pipeline),

    maxY: 0,

    detectedModifications: Array.from(detectedModifications),

    newTagValues: uniqueTagValues,
    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,
    readClipAtStart: new Uint32Array(clipAtStart),

    // One shared insert-size scale for every group of the fetch (pooled in the
    // worker entry), so stacked sections stay color-comparable.
    insertSizeStats,

    ...chainFields,

    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),

    overlapPositions: new Uint32Array(0),
    overlapYs: new Uint16Array(0),

    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}

// Single worker entry for both the pileup and chain (linked-reads) displays.
// The shared spine — fetch, per-read/gap/mismatch arrays, coverage pipeline,
// result assembly — is identical; `isChain` gates the few divergent steps:
// chain pre-filters into chains and emits chain metadata; pileup fetches the
// reference sequence for modification coloring and computes sort-tag values.
//
// When `groupBy` is set, the single fetch is partitioned into N ordered groups
// and the spine runs once per group, returning one PileupDataResult per group.
// Pileup partitions per read (partitionFeatures); chain partitions per chain
// (partitionChains) so a chain stays whole, and is restricted to
// chain-consistent dimensions. Ungrouped fetches return a single group.
export async function executeRenderAlignmentData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderAlignmentDataArgs
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    filterBy,
    colorBy,
    sortTag,
    groupBy: groupByArg,
    showSoftClipping = false,
    linkedReads = 'off',
    drawSingletons = true,
    drawProperPairs = true,
    statusCallback = () => {},
    stopToken,
  } = args
  const region = regions[0]!
  const isChain = linkedReads !== 'off'
  // Chain mode never expands soft clips or fetches sequence/sort-tag data.
  const effShowSoftClipping = isChain ? false : showSoftClipping
  // Chain mode allows grouping only on chain-consistent dimensions (tag /
  // firstOfPairStrand / pairOrientation), where every read of a chain yields the
  // same key so partitionChains keeps the chain whole. A disallowed dimension
  // (e.g. an old session with strand + chain) degrades to ungrouped rather than
  // splitting chains. See ./CLAUDE.md.
  const groupBy =
    isChain && !isChainGroupableType(groupByArg?.type) ? undefined : groupByArg

  const { featuresArray, stopTokenCheck } = await fetchFeaturesFromAdapter({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    filterBy,
    statusCallback,
    stopToken,
  })

  // The singleton/proper-pair filter groups reads by name, so it applies in
  // both pileup and chain mode (it short-circuits to a plain dedupe when both
  // are kept, the default). Only bisulfite needs the reference sequence (its
  // methylation is read-vs-reference C->T). modBAM modifications/methylation
  // derive everything from the reads, including the mod-coverage denominator
  // (computeReadBaseCounts), so they fetch nothing.
  let regionSequence: string | undefined
  let regionSequenceStart = region.start
  const inputFeatures = filterChainFeatures(
    featuresArray,
    drawSingletons,
    drawProperPairs,
  )
  if (!isChain && colorBy?.type === 'bisulfite' && sequenceAdapter) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray,
    })
    regionSequence = result.regionSequence?.toLowerCase()
    regionSequenceStart = result.regionSequenceStart
  }

  const featureGroups = isChain
    ? partitionChains(inputFeatures, groupBy)
    : partitionFeatures(inputFeatures, groupBy)
  const buildFeatureData = isChain
    ? buildChainFeatureData
    : buildBaseFeatureData
  const extractOpts = {
    colorBy,
    showSoftClipping: effShowSoftClipping,
    region,
    sortTag: isChain ? undefined : sortTag,
    regionSequence,
    regionSequenceStart,
  }

  // Extract per group, then resolve simplex modifications across ALL groups —
  // simplex-ness is a protocol property of the whole dataset, so a per-group
  // answer would color the same modification differently between sections.
  // One reporter shared across all groups: report() owns the running counter,
  // so per-group extractions accumulate into a single 0→total bar over every
  // read (deep pileups are O(reads)-heavy in extractFeatureArrays).
  const extractReport = createProgressReporter({
    label: 'Processing alignments',
    total: inputFeatures.length,
    statusCallback,
    stopTokenCheck,
  })
  const extractions = await updateStatus(
    'Processing alignments',
    statusCallback,
    async () =>
      featureGroups.map(g =>
        extractFeatureArrays(
          g.features,
          buildFeatureData,
          extractOpts,
          extractReport,
        ),
      ),
  )
  const seenModTypes = new Map(extractions.flatMap(e => [...e.seenModTypes]))
  const detectedSimplexModifications = detectSimplexModifications([
    ...seenModTypes.values(),
  ])

  // One insert-size color scale pooled across ALL groups — the insert-size
  // distribution is a property of the whole fetched read set, not of a group,
  // so a per-group scale would color the same insert size differently between
  // stacked sections. Same cross-section comparability as the simplex-mod set
  // above. Chain keys on template length, pileup on the per-read insert size.
  const allFeatures = extractions.flatMap(e => e.features)
  const sharedInsertSizeStats = isChain
    ? computeChainInsertSizeStats(allFeatures as ChainFeatureData[])
    : computePairedInsertSizeStats(allFeatures)

  checkStopToken2(stopTokenCheck)

  // Modification color modes (pileup only) draw mod coverage + track per-base
  // strands; chain omits them so runCoveragePipeline skips mod-coverage.
  const trackStrands =
    !isChain && !!colorBy && isModificationScheme(colorBy.type)

  const ctx: GroupContext = {
    isChain,
    region,
    effShowSoftClipping,
    trackStrands,
    detectedSimplexModifications,
    insertSizeStats: sharedInsertSizeStats,
    statusCallback,
    stopTokenCheck,
  }

  const groups: AlignmentGroup[] = []
  for (let i = 0; i < featureGroups.length; i++) {
    const fg = featureGroups[i]!
    const data = await buildGroupResult(extractions[i]!, fg.features, ctx)
    groups.push({ key: fg.key, label: fg.label, data })
  }

  return rpcResult({ groups }, collectGroupedTransferables(groups))
}
