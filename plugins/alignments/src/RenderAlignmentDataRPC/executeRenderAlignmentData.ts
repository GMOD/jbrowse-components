import { dedupe, groupBy, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import {
  buildBaseFeatureData,
  buildChainFeatureData,
} from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildChainMetadata } from '../shared/buildChainMetadata.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { collectResultTransferables } from '../shared/collectTransferables.ts'
import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'

import type { PileupDataResult, RenderAlignmentDataArgs } from './types.ts'
import type { ChainFeatureData } from '../shared/webglRpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

// Chain mode groups reads into chains by name, then optionally drops
// singletons (chains of one) and proper pairs (every read has the 0x2 flag).
function filterChainFeatures(
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
    rawChains = rawChains.filter(
      c =>
        !c.every(
          (f: Feature) => !!(((f.get('flags') as number | undefined) ?? 0) & 2),
        ),
    )
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
    chainStats,
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
    insertSizeStats: chainStats,
  }
}

// Single worker entry for both the pileup and chain (linked-reads) displays.
// The shared spine — fetch, per-read/gap/mismatch arrays, coverage pipeline,
// result assembly — is identical; `isChain` gates the few divergent steps:
// chain pre-filters into chains and emits chain metadata; pileup fetches the
// reference sequence for modification coloring and computes sort-tag values.
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
  } else if (
    (colorBy?.type === 'methylation' || colorBy?.type === 'modifications') &&
    sequenceAdapter
  ) {
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

  const {
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    perBaseQualities,
    tagColorValues,
    sortTagValues,
    uniqueTagValues,
    nextRefs,
    nextPositions,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  } = await updateStatus('Processing alignments', statusCallback, async () =>
    extractFeatureArrays(
      inputFeatures,
      isChain ? buildChainFeatureData : buildBaseFeatureData,
      {
        colorBy,
        showSoftClipping: effShowSoftClipping,
        region,
        sortTag: isChain ? undefined : sortTag,
      },
    ),
  )

  checkStopToken2(stopTokenCheck)

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
        insertSizeStats: computePairedInsertSizeStats(features),
        sortTagValues,
      }

  const {
    gapArrays,
    mismatchArrays,
    softclipBaseArrays,
    interbaseArrays,
    modificationArrays,
    perBaseQualityArrays,
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
    detectedModifications,
    region,
    getReadIndex,
    showSoftClipping: effShowSoftClipping,
    statusCallback,
  })

  checkStopToken2(stopTokenCheck)

  // Pileup tracks per-base strands + reference sequence for modification
  // coverage; chain omits both so runCoveragePipeline skips mod-coverage.
  const trackStrands =
    !isChain &&
    (colorBy?.type === 'modifications' || colorBy?.type === 'methylation')

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

  const result: PileupDataResult = {
    ...readArrays,
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

  return rpcResult(result, collectResultTransferables(result))
}
