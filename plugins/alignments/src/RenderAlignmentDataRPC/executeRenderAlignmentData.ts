import {
  buildReadNameBlock,
  readIdPrefixOf,
  readKeyOf,
  readNameAt,
} from '@jbrowse/alignments-core'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { createProgressReporter, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { computeReadBaseCounts } from '../features/modCoverage/readBaseCounts.ts'
import {
  computeSplitJunctions,
  fetchedSplitSegments,
} from '../features/sashimi/splitJunctions.ts'
import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import { buildBaseFeatureData } from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { chainGroupingKey } from '../shared/chainGroupingKey.ts'
import { collectGroupedTransferables } from '../shared/collectTransferables.ts'
import { isModificationField } from '../shared/colorFieldDefs.ts'
import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import {
  drawnInstanceArrays,
  drawnReadLists,
  readCompaction,
  sampleEventsOf,
} from '../shared/drawnReads.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { partitionFeatures } from '../shared/groupFeatures.ts'
import {
  buildReadBlockLines,
  buildReadTooltipValues,
} from '../shared/readHoverLines.ts'
import {
  buildReadInterchrom,
  buildReadNextRefs,
} from '../shared/readNextRefs.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'
import { getFlags } from '../shared/util.ts'
import {
  drawnReadMask,
  mateKey,
  sampleFeatures,
} from './filterChainFeatures.ts'

import type { JunctionReference } from '../features/sashimi/compute.ts'
import type { FetchedSegments } from '../features/sashimi/splitJunctions.ts'
import type { StrandBaseCounts } from '../shared/calculateModificationCounts.ts'
import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ModCoverageKind } from '../shared/runCoveragePipeline.ts'
import type { ModificationEntry } from '../shared/webglRpcTypes.ts'
import type { DrawnReadSource } from './filterChainFeatures.ts'
import type { AlignmentGroup, WorkerPileupData } from './types.ts'
import type {
  InterbaseIndicatorRule,
  ReadNames,
} from '@jbrowse/alignments-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature, Region, StatusCallback } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

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
  showSoftClips: boolean
  showCoverage: boolean
  interbaseIndicators: InterbaseIndicatorRule | undefined
  junctions: boolean
  // Which modification coverage the band stacks: modBAM calls over a read-base
  // pileup, or bisulfite's C->T-derived methylation level. Undefined outside the
  // modification color modes.
  modCoverage: ModCoverageKind | undefined
  // The region's reference bases, for the junctions' splice motifs. Fetched
  // once for the whole fetch and only when some group carries a skip gap.
  junctionReference: JunctionReference | undefined
  // Every group's split segments, so a split junction counts once per region.
  fetchedSegments: FetchedSegments
  detectedSimplexModifications: ReadonlySet<string>
  // One insert-size color scale for every section, from the sample before the
  // category filters (see computePairedInsertSizeStats).
  insertSizeStats: InsertSizeBand | undefined
  // `tooltip.field`, '' when unset
  tooltipField: string
  jexl: JexlInstance
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

interface Section {
  features: Feature[]
  categoryBits: Uint8Array
  names: ReadNames
}

// Every section's reads in order, as the drawn-read fields test them
function sectionsSource(sections: Section[]): DrawnReadSource {
  const features = sections.flatMap(s => s.features)
  const sectionOf = new Uint32Array(features.length)
  const starts = new Uint32Array(sections.length)
  let at = 0
  for (const [j, s] of sections.entries()) {
    starts[j] = at
    sectionOf.fill(j, at, at + s.features.length)
    at += s.features.length
  }
  const name = (i: number) => {
    const j = sectionOf[i]!
    return readNameAt(sections[j]!.names, i - starts[j]!)
  }
  return {
    length: features.length,
    categoryBits: i => {
      const j = sectionOf[i]!
      return sections[j]!.categoryBits[i - starts[j]!]!
    },
    name,
    chainKey: i =>
      chainGroupingKey(
        name(i),
        readKeyOf(features[i]!),
        getFlags(features[i]!),
      ),
    mateKey: i => mateKey(features[i]!),
  }
}

// One fetch-wide mask cut back into its sections
function sectionMasks(sections: Section[], mask: Uint8Array | undefined) {
  let at = 0
  return sections.map(s => {
    const start = at
    at += s.features.length
    return mask?.subarray(start, at)
  })
}

// The shared spine for one group's reads: per-read/gap/mismatch arrays,
// coverage pipeline, result assembly. Identical for grouped and ungrouped
// fetches — ungrouped is just the one-group case.
//
// Every read of the sample runs through the detail arrays and the coverage
// pipeline, so the band, the fade and the junctions count the reads a filter
// leaves out of the pileup; the drawn reads are compacted out after.
async function buildGroupResult(
  extraction: ReturnType<typeof extractFeatureArrays>,
  // Raw reads for this group, needed to tally per-strand read bases at modified
  // positions (the reference-free mod-coverage denominator).
  rawFeatures: Feature[],
  readNames: ReadNames,
  // 1 for each read the filter draws, undefined while it draws every one
  drawnMask: Uint8Array | undefined,
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
    suppAlignments,
    clipAtStart,
    detectedModifications,
  } = extraction
  const {
    readIdPrefix,
    region,
    showSoftClips,
    showCoverage,
    interbaseIndicators,
    junctions,
    modCoverage,
    junctionReference,
    fetchedSegments,
    detectedSimplexModifications,
    insertSizeStats,
    tooltipField,
    jexl,
    statusCallback,
    signal,
  } = ctx

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
    showSoftClips,
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
    interbaseIndicators,
    junctions,
    modCoverage,
    junctionReference,
    splitJunctions: junctions
      ? computeSplitJunctions({
          refName: region.refName,
          features,
          suppAlignments,
          clipAtStart,
          readNames,
          fetched: fetchedSegments,
        })
      : undefined,
    statusCallback,
    signal,
  })

  const instances = {
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
    ...segmentArrays,
  }
  const lists = {
    features,
    rawFeatures,
    tagColorValues: extraction.tagColorValues,
    sortTagValues: extraction.sortTagValues,
    nextPositions: extraction.nextPositions,
    suppAlignments,
    categoryBits: extraction.categoryBits,
    clipAtStart,
  }
  const compaction = drawnMask && readCompaction(drawnMask)
  const drawnLists = compaction ? drawnReadLists(lists, compaction) : lists
  const drawn = compaction
    ? {
        instances: drawnInstanceArrays(instances, compaction),
        lists: drawnLists,
        readNames: buildReadNameBlock(drawnLists.rawFeatures),
        sampleEvents: sampleEventsOf(instances),
      }
    : { instances, lists, readNames, sampleEvents: undefined }

  // Layout (readYs/gapYs/mismatchYs/etc.) and chain identity are the main
  // thread's — see `PileupLayoutArrays` and `ChainFields`.
  const { readArrays } = buildBaseReadArrays(drawn.lists.features, readIdPrefix)

  // Both modes, off the raw features, for the same reason the name block is:
  // the mate's reference is a NUMBER on the record and only becomes a string
  // through `refIdToName`. See shared/readNextRefs.ts.
  const nextRefs = buildReadNextRefs(drawn.lists.rawFeatures)

  // Derived here where the mate-reference table and the region refName are both
  // in scope, rather than threaded through the array builders. Resolved per
  // distinct contig rather than per read.
  const readInterchrom = buildReadInterchrom(
    nextRefs,
    region.refName,
    drawn.lists.features.length,
  )

  return {
    ...readArrays,
    ...drawn.readNames,
    ...nextRefs,
    readInterchrom,
    ...drawn.instances,

    // The raw per-read strings the main thread bakes `readFillColors` from
    // (`overlayReadFillColors`), so no color table crosses this boundary. The
    // baked arrays themselves are not this tier's to state — see
    // `WorkerPileupData`.
    readTagValues: drawn.lists.tagColorValues,

    ...buildCoverageResultFields(pipeline),

    detectedModifications: Array.from(detectedModifications),

    readNextPositions: new Uint32Array(drawn.lists.nextPositions),
    readSuppAlignments: drawn.lists.suppAlignments,
    // off the drawn reads, as the name block is, so index i titles read i
    // after a filter leaves reads out
    readTooltipValues: tooltipField
      ? buildReadTooltipValues(drawn.lists.rawFeatures, tooltipField, jexl)
      : undefined,
    readBlockLines: buildReadBlockLines(drawn.lists.rawFeatures),
    readCategoryBits: drawn.lists.categoryBits,
    readClipAtStart: new Uint32Array(drawn.lists.clipAtStart),

    insertSizeStats,

    sortTagValues: drawn.lists.sortTagValues,

    sampleEvents: drawn.sampleEvents,
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
    filter,
    lodTier,
    byteLimit,
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
    filter,
    lodTier,
    statusCallback,
    signal,
  })
  const groups = await groupsOfFetch({ pluginManager, args, featuresArray })
  return rpcResult(
    { groups, bytes, lodTier },
    collectGroupedTransferables(groups),
  )
}

/**
 * The sections of one fetch: the sample filters, the facet's partition, and
 * each section's arrays.
 */
export async function groupsOfFetch({
  pluginManager,
  args,
  featuresArray,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderAlignmentData'>
  featuresArray: Feature[]
}) {
  const {
    sessionId,
    sequenceAdapter,
    regions,
    filter,
    colorField,
    tooltipField = '',
    baseLayer,
    sortTag,
    facet,
    showSoftClips = false,
    showCoverage = true,
    interbaseIndicators,
    junctions = true,
    perBaseBinBp = 1,
    statusCallback,
    signal,
  } = args
  const region = regions[0]!
  const sample = sampleFeatures(featuresArray, filter)
  const insertSizeStats = computePairedInsertSizeStats(sample)

  // Only bisulfite needs the reference sequence (its methylation is
  // read-vs-reference C->T). modBAM modifications/methylation derive
  // everything from the reads, including the mod-coverage denominator
  // (computeReadBaseCounts), so they fetch nothing.
  let regionSequence: string | undefined
  let regionSequenceStart = region.start
  if (baseLayer?.field === 'bisulfite' && sequenceAdapter) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray: sample,
      signal,
    })
    regionSequence = result.regionSequence?.toLowerCase()
    regionSequenceStart = result.regionSequenceStart
  }

  const featureGroups = partitionFeatures(sample, facet, pluginManager.jexl)
  // One prefix for the whole fetch, off the unfiltered feature set so an empty
  // group still gets the same form as its siblings.
  const readIdPrefix = readIdPrefixOf(featuresArray)
  const buildFeatureData = (f: Feature) => buildBaseFeatureData(f, readIdPrefix)
  const extractOpts = {
    jexl: pluginManager.jexl,
    colorField,
    baseLayer,
    showSoftClips,
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
    total: sample.length,
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

  checkAbortSignal(signal)

  const modCoverage: ModCoverageKind | undefined =
    !baseLayer || !isModificationField(baseLayer.field)
      ? undefined
      : baseLayer.field === 'bisulfite'
        ? 'bisulfite'
        : 'modifications'

  // Splice motifs need the reference under every junction. A spliced read is
  // the one signal that this is RNA-seq, so a DNA-seq fetch never reads
  // sequence here; bisulfite already fetched the same span, so reuse it.
  if (
    junctions &&
    regionSequence === undefined &&
    sequenceAdapter &&
    extractions.some(e => e.gaps.some(g => g.type === 'skip'))
  ) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray: sample,
      signal,
    })
    regionSequence = result.regionSequence
    regionSequenceStart = result.regionSequenceStart
  }
  const junctionReference =
    regionSequence === undefined
      ? undefined
      : { sequence: regionSequence, start: regionSequenceStart }

  // From the RAW features, not the extracted ones: BAM hands over its QNAME
  // bytes and the block is decoded in one call, so no name string is ever built
  // per read. `extractFeatureArrays` is 1:1 with its input, so index i is the
  // same read in both.
  const readNamesByGroup = featureGroups.map(g =>
    buildReadNameBlock(g.features),
  )
  // Judged over every section's reads at once, so a strand facet cannot split
  // a chain's verdict, off the category bits and names already in hand
  const sections = featureGroups.map((g, i) => ({
    features: g.features,
    categoryBits: extractions[i]!.categoryBits,
    names: readNamesByGroup[i]!,
  }))
  const drawnMasks = sectionMasks(
    sections,
    drawnReadMask(sectionsSource(sections), filter),
  )
  const fetchedSegments = junctions
    ? fetchedSplitSegments(
        extractions.map((e, i) => ({ ...e, readNames: readNamesByGroup[i]! })),
      )
    : new Map()

  const ctx: GroupContext = {
    readIdPrefix,
    region,
    showSoftClips,
    showCoverage,
    interbaseIndicators,
    junctions,
    modCoverage,
    junctionReference,
    fetchedSegments,
    detectedSimplexModifications,
    insertSizeStats,
    tooltipField,
    jexl: pluginManager.jexl,
    statusCallback,
    signal,
  }

  const groups: AlignmentGroup[] = []
  for (let i = 0; i < featureGroups.length; i++) {
    const fg = featureGroups[i]!
    const data = await buildGroupResult(
      extractions[i]!,
      fg.features,
      readNamesByGroup[i]!,
      drawnMasks[i],
      ctx,
    )
    groups.push({
      key: fg.key,
      label: fg.label,
      data,
      mergedKeys: fg.mergedKeys,
    })
  }

  return groups
}
