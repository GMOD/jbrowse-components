import { dedupe, groupBy, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import { buildChainFeatureData } from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildChainMetadata } from '../shared/buildChainMetadata.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { collectResultTransferables } from '../shared/collectTransferables.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'

import type { RenderChainDataArgs } from './types.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: RenderChainDataArgs
}

export async function executeRenderChainData({
  pluginManager,
  args,
}: ExecuteParams) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    filterBy,
    colorBy,
    colorTagMap,
    drawSingletons = true,
    drawProperPairs = true,
    statusCallback = () => {},
    stopToken,
  } = args
  const region = regions[0]!

  const { featuresArray, regionStart, stopTokenCheck } =
    await fetchFeaturesFromAdapter({
      pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
      region,
      filterBy,
      statusCallback,
      stopToken,
    })

  const deduped = dedupe(featuresArray, (f: Feature) => f.id())
  let keptIds: Set<string> | undefined
  if (!drawSingletons || !drawProperPairs) {
    const byName = groupBy(deduped, (f: Feature) => f.get('name') ?? '')
    let rawChains = Object.values(byName)
    if (!drawSingletons) {
      rawChains = rawChains.filter(c => c.length > 1)
    }
    if (!drawProperPairs) {
      rawChains = rawChains.filter(
        c => !c.every((f: Feature) => !!((f.get('flags') ?? 0) & 2)),
      )
    }
    keptIds = new Set<string>()
    for (const chain of rawChains) {
      for (const f of chain) {
        keptIds.add(f.id())
      }
    }
  }
  const keptFeatures = keptIds
    ? deduped.filter(f => keptIds.has(f.id()))
    : deduped

  const {
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    perBaseQualities,
    tagColors,
    uniqueTagValues,
    nextPositions,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  } = await updateStatus('Processing alignments', statusCallback, async () =>
    extractFeatureArrays(keptFeatures, buildChainFeatureData, {
      colorBy,
      colorTagMap,
      showSoftClipping: false,
      region,
      regionStart,
    }),
  )

  checkStopToken2(stopTokenCheck)

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

  // Layout Ys are filled by the main thread (see computeChainLayout.ts);
  // the worker emits zero-filled Y arrays here.
  const { readArrays, featureIdToIndex } = buildBaseReadArrays(
    features,
    regionStart,
  )
  const getReadIndex = (id: string) => featureIdToIndex.get(id)!

  // Chain-specific per-read arrays linking each read back to its chain.
  const readChainHasSupp = new Uint8Array(features.length)
  const readChainIndices = new Uint32Array(features.length)
  const readNextRefs: string[] = []
  const chainFirstReadSeen = new Uint8Array(numChains)
  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const cIdx = featureIdToChainIdx.get(f.id) ?? 0
    readChainHasSupp[i] = chainSuppTypes[cIdx] ? 1 : 0
    readChainIndices[i] = cIdx
    readNextRefs.push(f.nextRef ?? '')
    if (!chainFirstReadSeen[cIdx]) {
      chainFirstReadSeen[cIdx] = 1
      chainFirstReadIndices[cIdx] = i
    }
  }

  const regionEnd = Math.ceil(region.end)

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
    regionStart,
    regionEnd,
    getReadIndex,
    statusCallback,
  })

  checkStopToken2(stopTokenCheck)

  // Chain omits regionSequence so runCoveragePipeline skips mod-coverage and
  // packCoverageAreaForGpu emits a 0-byte mod-cov pass.
  const pipeline = await runCoveragePipeline({
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    regionStart,
    regionEnd,
    mismatchArrays,
    interbaseArrays,
    gapArrays,
    statusCallback,
    stopTokenCheck,
  })

  const result: PileupDataResult = {
    ...readArrays,
    readChainHasSupp,
    readNextRefs,
    readChainIndices,
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

    readTagColors: tagColors,

    ...buildCoverageResultFields(pipeline),

    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainHasMultiple,
    chainFirstReadIndices,

    maxY: 0,

    detectedModifications: Array.from(detectedModifications),
    simplexModifications: Array.from(detectedSimplexModifications),

    insertSizeStats: chainStats,

    newTagValues: uniqueTagValues,
    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,

    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),

    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }

  return rpcResult(result, collectResultTransferables(result))
}
