import { readIdPrefixOf, buildReadNameBlock } from '@jbrowse/alignments-core'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import { buildBaseFeatureData } from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { collectGroupedTransferables } from '../shared/collectTransferables.ts'
import { isModificationScheme } from '../shared/colorSchemes.ts'
import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { partitionFeatures } from '../shared/groupFeatures.ts'
import {
  buildReadInterchrom,
  buildReadNextRefs,
} from '../shared/readNextRefs.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type { JunctionReference } from '../features/sashimi/compute.ts'
import type { StrandBaseCounts } from '../shared/calculateModificationCounts.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ModCoverageKind } from '../shared/runCoveragePipeline.ts'
import type { ModificationEntry } from '../shared/webglRpcTypes.ts'
import type { AlignmentGroup, WorkerPileupData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'

// Per-group context shared across every section of one fetch. The region
// sequence, simplex-modification set, and color/softclip flags are global to
// the fetch (not the group) — resolving them once keeps modification coloring
// identical in every section.
interface GroupContext {
  // The fetch's verified `${adapter.id}-`, or undefined when its features carry
  // no numeric record id. Resolved once for the whole fetch rather than per
  // group so every section's `readKeys` are the same form. See
  // alignments-core/src/readIdentity.ts.
  readIdPrefix: string | undefined
  region: Region
  showSoftClipping: boolean
  showCoverage: boolean
  // Which modification coverage the band stacks: modBAM calls over a read-base
  // pileup, or bisulfite's C->T-derived methylation level. Undefined outside the
  // modification color modes.
  modCoverage: ModCoverageKind | undefined
  // The region's reference bases, for the junctions' splice motifs. Fetched
  // once for the whole fetch and only when some group carries a skip gap.
  junctionReference: JunctionReference | undefined
  detectedSimplexModifications: ReadonlySet<string>
  // Shared insert-size color scale, pooled across every group of the fetch so
  // all stacked sections color long/short inserts on one comparable scale.
  insertSizeStats: InsertSizeBand | undefined
  statusCallback: StatusCallback | undefined
  signal?: AbortSignal
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
    readIdPrefix,
    region,
    showSoftClipping,
    showCoverage,
    modCoverage,
    junctionReference,
    detectedSimplexModifications,
    insertSizeStats,
    statusCallback,
    signal,
  } = ctx

  // Layout (readYs/gapYs/mismatchYs/etc.) and chain identity are the main
  // thread's — see `PileupLayoutArrays` and `ChainFields`.
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
    showSoftClipping,
    statusCallback,
  })

  checkAbortSignal(signal)

  // IGV-style per-strand read-base pileup at the modified columns, computed from
  // the reads themselves — the modBAM mod-coverage denominator, no reference
  // needed. Bisulfite derives its bar from the C->T calls alone (see
  // computeBisulfiteCoverage), so it skips this pileup entirely, and so does a
  // fetch with the coverage band off, whose mod coverage nothing computes.
  const modBaseCounts =
    showCoverage && modCoverage === 'modifications'
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
    modCoverage,
    junctionReference,
    statusCallback,
    signal,
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

    sortTagValues,
  }
}

// The worker entry for every alignments display. When `facet` is set, the fetch
// is partitioned into N ordered groups and the spine runs once per group,
// returning one WorkerPileupData per group; ungrouped fetches return one.
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
    baseLayer,
    sortTag,
    facet,
    lodMode,
    showSoftClipping = false,
    showCoverage = true,
    byteLimit,
    perBaseBinBp = 1,
    statusCallback,
    signal,
  } = args
  const region = regions[0]!

  // The gate, and the first await of the fetch: an over-budget region is
  // refused off one index read, before a single read is downloaded. Resolving
  // the adapter here rather than inside `fetchFeaturesFromAdapter` below costs
  // nothing — `getAdapter` is cached, so the second resolution is a map hit.
  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter: await getFeatureAdapterOrThrow({ ...args, pluginManager }),
    regions: [region],
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  const { featuresArray } = await fetchFeaturesFromAdapter({
    pluginManager,
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    filterBy,
    lodMode,
    statusCallback,
    signal,
  })

  // The singleton/proper-pair filter groups reads by name (it short-circuits to
  // a plain dedupe when both are kept, the default). Only bisulfite needs the reference sequence (its
  // methylation is read-vs-reference C->T). modBAM modifications/methylation
  // derive everything from the reads, including the mod-coverage denominator
  // (computeReadBaseCounts), so they fetch nothing.
  let regionSequence: string | undefined
  let regionSequenceStart = region.start
  const inputFeatures = filterChainFeatures(featuresArray, filterBy)
  if (baseLayer?.type === 'bisulfite' && sequenceAdapter) {
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

  const featureGroups = partitionFeatures(
    inputFeatures,
    facet,
    pluginManager.jexl,
  )
  // One prefix for the whole fetch, off the unfiltered feature set so an empty
  // group still gets the same form as its siblings.
  const readIdPrefix = readIdPrefixOf(featuresArray)
  const buildFeatureData = (f: Feature) => buildBaseFeatureData(f, readIdPrefix)
  const extractOpts = {
    jexl: pluginManager.jexl,
    colorBy,
    baseLayer,
    showSoftClipping,
    region,
    sortTag,
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
    signal,
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
  // above.
  const sharedInsertSizeStats = computePairedInsertSizeStats(
    extractions.map(e => e.features),
  )

  checkAbortSignal(signal)

  const modCoverage: ModCoverageKind | undefined =
    !baseLayer || !isModificationScheme(baseLayer.type)
      ? undefined
      : baseLayer.type === 'bisulfite'
        ? 'bisulfite'
        : 'modifications'

  // Splice motifs need the reference under every junction. A spliced read is
  // the one signal that this is RNA-seq, so a DNA-seq fetch never reads
  // sequence here; bisulfite already fetched the same span, so reuse it.
  // Junctions are part of the coverage band, so nothing reads it without one.
  if (
    showCoverage &&
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
    readIdPrefix,
    region,
    showSoftClipping,
    showCoverage,
    modCoverage,
    junctionReference,
    detectedSimplexModifications,
    insertSizeStats: sharedInsertSizeStats,
    statusCallback,
    signal,
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

  return rpcResult(
    { groups, bytes, lodMode },
    collectGroupedTransferables(groups),
  )
}
