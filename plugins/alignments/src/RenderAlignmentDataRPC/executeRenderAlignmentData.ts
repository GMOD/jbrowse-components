import { dedupe, groupBy, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import {
  buildBaseFeatureData,
  buildChainFeatureData,
} from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildChainMetadata } from '../shared/buildChainMetadata.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
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

// Chain mode groups reads into chains by name, then optionally drops
// singletons (chains of one) and proper pairs.
export function filterChainFeatures(
  features: Feature[],
  drawSingletons: boolean,
  drawProperPairs: boolean,
) {
  const deduped = dedupe(features, (f: Feature) => f.id())
  if (drawSingletons && drawProperPairs) {
    return deduped
  }
  const byName = groupBy(deduped, (f: Feature) => f.get('name') ?? '')
  let rawChains = Object.values(byName)
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
function buildChainResultFields(
  features: ChainFeatureData[],
): Partial<PileupDataResult> {
  const {
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainSuppTypes,
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
  regionSequence: string | undefined
  regionSequenceStart: number
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
    detectedModifications,
  } = extraction
  const {
    isChain,
    region,
    effShowSoftClipping,
    trackStrands,
    regionSequence,
    regionSequenceStart,
    detectedSimplexModifications,
    insertSizeStats,
    statusCallback,
    stopTokenCheck,
  } = ctx

  // Layout (readYs/gapYs/mismatchYs/etc.) is computed on the main thread via
  // `laidOutPileupMap` (pileup) / `computeChainLayout` (chain) — the worker
  // emits zero-filled Y arrays.
  const { readArrays, featureIdToIndex } = buildBaseReadArrays(
    features,
    region.start,
  )
  const getReadIndex = (id: string) => {
    const idx = featureIdToIndex.get(id)
    if (idx === undefined) {
      throw new Error(
        `no read index for feature id ${id} (detail/read mismatch)`,
      )
    }
    return idx
  }

  // `isChain` implies the chain builder ran, so `features` are ChainFeatureData.
  const chainFields: Partial<PileupDataResult> = isChain
    ? buildChainResultFields(features as ChainFeatureData[])
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
    getReadIndex,
    showSoftClipping: effShowSoftClipping,
    statusCallback,
  })

  checkStopToken2(stopTokenCheck)

  const pipeline = await runCoveragePipeline({
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    simplexModifications: detectedSimplexModifications,
    region,
    mismatchArrays,
    interbaseArrays,
    gapArrays,
    trackStrands,
    regionSequence,
    regionSequenceStart,
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

  // Chain mode dedupes + filters reads into chains up front; pileup mode
  // fetches the reference sequence when coloring by methylation/modifications.
  let inputFeatures = featuresArray
  let regionSequence: string | undefined
  let regionSequenceStart = region.start
  if (isChain) {
    inputFeatures = filterChainFeatures(
      featuresArray,
      drawSingletons,
      drawProperPairs,
    )
  } else if (colorBy && isModificationScheme(colorBy.type) && sequenceAdapter) {
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
  const extractions = await updateStatus(
    'Processing alignments',
    statusCallback,
    async () =>
      featureGroups.map(g =>
        extractFeatureArrays(g.features, buildFeatureData, extractOpts),
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

  // Pileup tracks per-base strands + reference sequence for modification
  // coverage; chain omits both so runCoveragePipeline skips mod-coverage.
  const trackStrands =
    !isChain && !!colorBy && isModificationScheme(colorBy.type)

  const ctx: GroupContext = {
    isChain,
    region,
    effShowSoftClipping,
    trackStrands,
    regionSequence,
    regionSequenceStart,
    detectedSimplexModifications,
    insertSizeStats: sharedInsertSizeStats,
    statusCallback,
    stopTokenCheck,
  }

  const groups: AlignmentGroup[] = []
  for (let i = 0; i < featureGroups.length; i++) {
    const fg = featureGroups[i]!
    const data = await buildGroupResult(extractions[i]!, ctx)
    groups.push({ key: fg.key, label: fg.label, data })
  }

  return rpcResult({ groups }, collectGroupedTransferables(groups))
}
