import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import {
  createProgressReporter,
  groupBy,
  updateStatus,
} from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopTokenThrottled } from '@jbrowse/core/util/stopToken'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import {
  buildBaseFeatureData,
  buildChainFeatureData,
  isConcordantPairRead,
  pairOrientationToNum,
} from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildChainMetadata } from '../shared/buildChainMetadata.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { featureChainKey } from '../shared/chainGroupingKey.ts'
import { collectGroupedTransferables } from '../shared/collectTransferables.ts'
import { isModificationScheme } from '../shared/colorSchemes.ts'
import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import {
  groupByForMode,
  partitionChains,
  partitionFeatures,
} from '../shared/groupFeatures.ts'
import { readIdPrefixOf, readKeyOf } from '../shared/readIdentity.ts'
import { buildReadNameBlock } from '../shared/readNameBlock.ts'
import {
  buildReadInterchrom,
  buildReadNextRefs,
} from '../shared/readNextRefs.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'
import { chainIsSplit } from '../shared/splitAlignment.ts'
import { getFlags } from '../shared/util.ts'

import type { JunctionReference } from '../features/sashimi/compute.ts'
import type { StrandBaseCounts } from '../shared/calculateModificationCounts.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ReadKey } from '../shared/readIdentity.ts'
import type { CategoryFilter, FilterBy } from '../shared/types.ts'
import type {
  ChainFeatureData,
  ModificationEntry,
} from '../shared/webglRpcTypes.ts'
import type { AlignmentGroup, WorkerPileupData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'

// A chain counts as a proper pair only when EVERY read in it is the ordinary
// concordant case. The per-read rule is `isConcordantPairRead` — shared with the
// arc filter behind "Show concordant-pair arcs", so hiding the boring pairs and
// hiding their arcs cannot come to mean different things. It carries the reasons
// (why unknown orientation counts, why a supplementary never does).
//
// What is local here is only the quantifier and the conversion: this side holds
// `Feature`s, so the orientation string goes through `pairOrientationToNum` to
// reach the numeric form both callers share.
function isProperPairChain(chain: Feature[]) {
  return chain.every((f: Feature) =>
    isConcordantPairRead(
      getFlags(f),
      pairOrientationToNum(f.get('pair_orientation') as string | undefined),
    ),
  )
}

// Guard against the same physical record being emitted twice — a dup would
// double-count coverage depth and double-draw.
//
// Nothing has been observed to produce one for some time: `@gmod/bam`'s
// `blocksForRange` runs `optimizeChunks`, which absorbs a chunk already covered
// by its neighbour, and a sweep of ~4800 index queries over the 20x/200x/1000x
// fixtures found no overlapping chunk pair and no duplicate record. The
// motivation that is genuinely gone is the older one: block rendering fetched
// adjacent overlapping regions, so a feature spanning a boundary arrived twice,
// and there are no blocks now.
//
// It stays because it is now nearly free and because the failure it prevents is
// silent — a wrong depth, not a crash — and because the class is not
// hypothetical: `@gmod/bam` hit it in its own mate path ("their records came
// back twice") and still keeps a `readIds` set there. In the common no-dup case
// this returns the input array untouched, so it costs one Set build rather than
// a full-length copy.
function dedupeById(features: Feature[]) {
  const seen = new Set<ReadKey>()
  let dupIndex = -1
  for (let i = 0; i < features.length; i++) {
    const id = readKeyOf(features[i]!)
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
    const id = readKeyOf(f)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(f)
    }
  }
  return out
}

// Keep the chains a category filter asks for. `'only'` keeps the ones the
// predicate holds for, `'exclude'` drops them, and absent leaves them alone.
function keepCategory(
  chains: Feature[][],
  filter: CategoryFilter | undefined,
  predicate: (chain: Feature[]) => boolean,
) {
  return filter === undefined
    ? chains
    : chains.filter(c => predicate(c) === (filter === 'only'))
}

// The three read-category filters that need a whole chain to answer, applied
// after grouping reads by name. `filterBy.spliced` is the fourth and is not
// here: it is per-record, so the adapters answer it as they parse.
//
// PER WORKER CALL, i.e. per displayed region — the RPC takes `regions[0]`. So
// "chain of one" means "one alignment in THIS window", and in a multi-region
// view a read whose two alignments land in different windows is a singleton in
// both. `singletons` is absent by default, so this only bites a user who sets
// it; the menu's help text names the scope for that reason. `split` is the one
// that routes around it, by reading the SA tag rather than counting what this
// call happened to fetch (`chainIsSplit`) — the same move is not available for
// the other two, which are about what is on screen. Making them view-wide means
// moving the filter to the main thread, where the coverage histogram these also
// thin is no longer being computed.
export function filterChainFeatures(features: Feature[], filterBy?: FilterBy) {
  const deduped = dedupeById(features)
  const { properPairs, singletons, split } = filterBy ?? {}
  if (
    properPairs === undefined &&
    singletons === undefined &&
    split === undefined
  ) {
    return deduped
  }
  let rawChains = Object.values(groupBy(deduped, featureChainKey))
  rawChains = keepCategory(rawChains, singletons, c => c.length === 1)
  rawChains = keepCategory(rawChains, properPairs, isProperPairChain)
  rawChains = keepCategory(rawChains, split, chainIsSplit)
  // same key as the dedupe above, for the same reason: this is identity within
  // one fetch, which is the thing `readKeyOf` is cheap at
  const keptIds = new Set<ReadKey>()
  for (const chain of rawChains) {
    for (const f of chain) {
      keptIds.add(readKeyOf(f))
    }
  }
  return deduped.filter(f => keptIds.has(readKeyOf(f)))
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
): Partial<WorkerPileupData> {
  const {
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
  } = buildChainMetadata(features)
  const numChains = chainNames.length

  const readChainHasSupp = new Uint8Array(features.length)
  const readChainIndices = new Uint32Array(features.length)
  const chainFirstReadSeen = new Uint8Array(numChains)
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const cIdx = featureIdToChainIdx.get(f.id)!
    // Split bits are per-MATE: BOTH segments of a split mate get them so the
    // whole split read stands out; the normal partner mate has none and keeps
    // its pair color. ORed onto the chain's has-supp/frame bits rather than
    // replacing them — the two describe different units (this mate's junction,
    // the chain's orientation) and were only ever mutually exclusive because a
    // 0-4 enum had nowhere to put both.
    const splitKind =
      f.flags & SAM_FLAG_FIRST_IN_PAIR
        ? chainMate0SplitKind[cIdx]!
        : chainMate1SplitKind[cIdx]!
    readChainHasSupp[i] = chainSuppTypes[cIdx]! | splitKind
    readChainIndices[i] = cIdx
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
    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainFirstReadIndices,
  }
}

// Per-group context shared across every section of one fetch. The region
// sequence, simplex-modification set, and color/softclip flags are global to
// the fetch (not the group) — resolving them once keeps modification coloring
// identical in every section.
interface GroupContext {
  isChain: boolean
  // The fetch's verified `${adapter.id}-`, or undefined when its features carry
  // no numeric record id. Resolved once for the whole fetch rather than per
  // group so every section's `readKeys` are the same form. See
  // shared/readIdentity.ts.
  readIdPrefix: string | undefined
  region: Region
  effShowSoftClipping: boolean
  showCoverage: boolean
  trackStrands: boolean
  // Bisulfite mode splits the coverage bar by C->T-derived methylation level
  // rather than the modBAM base-pileup denominator (see computeModificationCoverage).
  bisulfite: boolean
  // The region's reference bases, for the junctions' splice motifs. Fetched
  // once for the whole fetch and only when some group carries a skip gap.
  junctionReference: JunctionReference | undefined
  detectedSimplexModifications: ReadonlySet<string>
  // Shared insert-size color scale, pooled across every group of the fetch so
  // all stacked sections color long/short inserts on one comparable scale.
  insertSizeStats: InsertSizeBand | undefined
  statusCallback: StatusCallback | undefined
  stopTokenCheck: StopTokenChecker
}

// The distinct columns carrying a modification call, which is what the
// read-base pileup tallies at. Built by walking the marks rather than as
// `new Set(modifications.map(m => m.position))`: the map's array is one entry
// per CALL — 0.84M of them on the `200x.longread.mod.bam` window the mod benches
// use — allocated whole and thrown away for a set of the tens of thousands of
// distinct positions inside it.
function modifiedPositions(modifications: ModificationEntry[]) {
  const positions = new Set<number>()
  for (const m of modifications) {
    positions.add(m.position)
  }
  return positions
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
): Promise<WorkerPileupData> {
  const {
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    bisulfiteCallCounts,
    perBaseQualities,
    perBaseLetters,
    tagColorValues,
    sortTagValues,
    nextPositions,
    suppAlignments,
    clipAtStart,
    detectedModifications,
  } = extraction
  const {
    isChain,
    readIdPrefix,
    region,
    effShowSoftClipping,
    showCoverage,
    trackStrands,
    bisulfite,
    junctionReference,
    detectedSimplexModifications,
    insertSizeStats,
    statusCallback,
    stopTokenCheck,
  } = ctx

  // Layout (readYs/gapYs/mismatchYs/etc.) is computed on the main thread via
  // `laidOutPileupMap` (pileup) / `computeChainLayout` (chain), which is also
  // where those arrays are allocated — see `PileupLayoutArrays`.
  const { readArrays } = buildBaseReadArrays(features, readIdPrefix)

  // From the RAW features, not the extracted ones: BAM hands over its QNAME
  // bytes and the block is decoded in one call, so no name string is ever built
  // per read. `extractFeatureArrays` is 1:1 with its input, so index i is the
  // same read in both.
  const readNames = buildReadNameBlock(rawFeatures)
  // Both modes, off the raw features, for the same reason the name block is:
  // the mate's reference is a NUMBER on the record and only becomes a string
  // through `refIdToName`. See shared/readNextRefs.ts.
  const nextRefs = buildReadNextRefs(rawFeatures)

  // `isChain` implies the chain builder ran, so `features` are ChainFeatureData.
  const chainFields: Partial<WorkerPileupData> = isChain
    ? buildChainResultFields(
        features as ChainFeatureData[],
        readArrays.readPairOrientations,
      )
    : { sortTagValues }

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
    region,
    showSoftClipping: effShowSoftClipping,
    statusCallback,
  })

  checkStopTokenThrottled(stopTokenCheck)

  // IGV-style per-strand read-base pileup at the modified columns, computed from
  // the reads themselves — the modBAM mod-coverage denominator, no reference
  // needed. Bisulfite derives its bar from the C->T calls alone (see
  // computeBisulfiteCoverage), so it skips this pileup entirely.
  const modBaseCounts =
    trackStrands && !bisulfite
      ? computeReadBaseCounts(rawFeatures, modifiedPositions(modifications))
      : new Map<number, StrandBaseCounts>()

  const pipeline = await runCoveragePipeline({
    features,
    gaps,
    insertions,
    softclips,
    hardclips,
    modifications,
    modBaseCounts,
    bisulfiteCallCounts,
    simplexModifications: detectedSimplexModifications,
    region,
    mismatchArrays,
    interbaseArrays,
    gapArrays,
    showCoverage,
    trackStrands,
    bisulfite,
    junctionReference,
    statusCallback,
    stopTokenCheck,
  })

  // Derived here where the mate-reference table and the region refName are both
  // in scope, rather than threaded through the array builders. Resolved per
  // distinct contig rather than per read.
  const readInterchrom = buildReadInterchrom(
    nextRefs,
    region.refName,
    features.length,
  )

  return {
    ...readArrays,
    ...readNames,
    ...nextRefs,
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

    // The raw per-read strings the main thread bakes `readTagColors` from
    // (`overlayReadTagColors`), so no color table crosses this boundary. The
    // baked arrays themselves are not this tier's to state — see
    // `WorkerPileupData`.
    readTagValues: tagColorValues,

    ...buildCoverageResultFields(pipeline),

    detectedModifications: Array.from(detectedModifications),

    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,
    readClipAtStart: new Uint32Array(clipAtStart),

    // One shared insert-size scale for every group of the fetch (pooled in the
    // worker entry), so stacked sections stay color-comparable.
    insertSizeStats,

    ...chainFields,
  }
}

// Single worker entry for both the pileup and chain (linked-reads) displays.
// The shared spine — fetch, per-read/gap/mismatch arrays, coverage pipeline,
// result assembly — is identical; `isChain` gates the few divergent steps:
// chain pre-filters into chains and emits chain metadata; pileup fetches the
// reference sequence for modification coloring and computes sort-tag values.
//
// When `groupBy` is set, the single fetch is partitioned into N ordered groups
// and the spine runs once per group, returning one WorkerPileupData per group.
// Pileup partitions per read (partitionFeatures); chain partitions per chain
// (partitionChains) so a chain stays whole, and is restricted to
// fragment-level dimensions. Ungrouped fetches return a single group.
export async function executeRenderAlignmentData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderAlignmentData'>
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
    lodMode,
    showSoftClipping = false,
    showCoverage = true,
    linkedReads = 'off',
    byteLimit,
    perBaseBinBp = 1,
    statusCallback,
    stopToken,
  } = args
  const region = regions[0]!

  // The gate, and the first await of the fetch: an over-budget region is
  // refused off one index read, before a single read is downloaded. Resolving
  // the adapter here rather than inside `fetchFeaturesFromAdapter` below costs
  // nothing — `getAdapter` is cached, so the second resolution is a map hit.
  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter: await getFeatureAdapterOrThrow({
      pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    }),
    regions: [region],
    byteLimit,
    stopToken,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const isChain = linkedReads !== 'off'
  // Chain mode never expands soft clips or fetches sequence/sort-tag data.
  const effShowSoftClipping = isChain ? false : showSoftClipping
  const effectiveGroupBy = groupByForMode(groupByArg, isChain)

  const { featuresArray, stopTokenCheck } = await fetchFeaturesFromAdapter({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    filterBy,
    lodMode,
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
  const inputFeatures = filterChainFeatures(featuresArray, filterBy)
  if (!isChain && colorBy?.type === 'bisulfite' && sequenceAdapter) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray: inputFeatures,
    })
    regionSequence = result.regionSequence?.toLowerCase()
    regionSequenceStart = result.regionSequenceStart
  }

  const featureGroups = isChain
    ? partitionChains(inputFeatures, effectiveGroupBy)
    : partitionFeatures(inputFeatures, effectiveGroupBy)
  // One prefix for the whole fetch, off the unfiltered feature set so an empty
  // group still gets the same form as its siblings.
  const readIdPrefix = readIdPrefixOf(featuresArray)
  const buildFeatureData = isChain
    ? (f: Feature) => buildChainFeatureData(f, readIdPrefix)
    : (f: Feature) => buildBaseFeatureData(f, readIdPrefix)
  const extractOpts = {
    colorBy,
    showSoftClipping: effShowSoftClipping,
    region,
    sortTag: isChain ? undefined : sortTag,
    perBaseBinBp,
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
  // above. `insertSize` is `abs(template_length)`, so chain and pileup share
  // this one denominator.
  const sharedInsertSizeStats = computePairedInsertSizeStats(
    extractions.map(e => e.features),
  )

  checkStopTokenThrottled(stopTokenCheck)

  // Modification color modes (pileup only) draw mod coverage + track per-base
  // strands; chain omits them so runCoveragePipeline skips mod-coverage.
  const trackStrands =
    !isChain && !!colorBy && isModificationScheme(colorBy.type)
  const bisulfite = !isChain && colorBy?.type === 'bisulfite'

  // Splice motifs need the reference under every junction. A spliced read is
  // the one signal that this is RNA-seq, so a DNA-seq fetch never reads
  // sequence here; bisulfite already fetched the same span, so reuse it.
  if (
    regionSequence === undefined &&
    sequenceAdapter &&
    extractions.some(e => e.gaps.some(g => g.type === 'skip'))
  ) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray: inputFeatures,
    })
    regionSequence = result.regionSequence
    regionSequenceStart = result.regionSequenceStart
  }
  const junctionReference =
    regionSequence === undefined
      ? undefined
      : { sequence: regionSequence, start: regionSequenceStart }

  const ctx: GroupContext = {
    isChain,
    readIdPrefix,
    region,
    effShowSoftClipping,
    showCoverage,
    trackStrands,
    bisulfite,
    junctionReference,
    detectedSimplexModifications,
    insertSizeStats: sharedInsertSizeStats,
    statusCallback,
    stopTokenCheck,
  }

  const groups: AlignmentGroup[] = []
  for (let i = 0; i < featureGroups.length; i++) {
    const fg = featureGroups[i]!
    const data = await buildGroupResult(extractions[i]!, fg.features, ctx)
    groups.push({
      key: fg.key,
      label: fg.label,
      data,
      mergedKeys: fg.mergedKeys,
    })
  }

  return rpcResult({ groups, bytes }, collectGroupedTransferables(groups))
}
