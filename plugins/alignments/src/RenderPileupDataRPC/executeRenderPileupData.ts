import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { buildAlignmentDetailArrays } from '../shared/buildAlignmentDetailArrays.ts'
import { buildBaseFeatureData } from '../shared/buildBaseFeatureData.ts'
import { buildBaseReadArrays } from '../shared/buildBaseReadArrays.ts'
import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { collectResultTransferables } from '../shared/collectTransferables.ts'
import { computePairedInsertSizeStats } from '../shared/computePairedInsertSizeStats.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { fetchFeaturesFromAdapter } from '../shared/fetchFeaturesFromAdapter.ts'
import { fetchReferenceSequence } from '../shared/fetchReferenceSequence.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'

import type { PileupDataResult, RenderPileupDataArgs } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function executeRenderPileupData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderPileupDataArgs
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    regions,
    filterBy,
    colorBy,
    colorTagMap,
    sortTag,
    showSoftClipping = false,
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

  let regionSequence: string | undefined
  let regionSequenceStart = regionStart
  if (
    (colorBy?.type === 'methylation' || colorBy?.type === 'modifications') &&
    sequenceAdapter
  ) {
    const result = await fetchReferenceSequence({
      pluginManager,
      sessionId,
      sequenceAdapter,
      region,
      featuresArray,
      regionStart,
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
    tagColors,
    sortTagValues,
    uniqueTagValues,
    nextRefs,
    nextPositions,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  } = await updateStatus('Processing alignments', statusCallback, async () =>
    extractFeatureArrays(featuresArray, buildBaseFeatureData, {
      colorBy,
      colorTagMap,
      showSoftClipping,
      region,
      regionStart,
      sortTag,
    }),
  )

  checkStopToken2(stopTokenCheck)

  const regionEnd = Math.ceil(region.end)

  // Layout (readYs/gapYs/mismatchYs/etc.) is computed on the main thread
  // via `laidOutPileupMap` in the display model — the worker emits
  // zero-filled Y arrays.
  const { readArrays, featureIdToIndex } = buildBaseReadArrays(
    features,
    regionStart,
  )
  const getReadIndex = (id: string) => featureIdToIndex.get(id)!

  const {
    gapArrays,
    mismatchArrays,
    softclipBaseArrays,
    interbaseArrays,
    modificationArrays,
    segmentArrays,
  } = await buildAlignmentDetailArrays({
    features,
    gaps,
    mismatches,
    insertions,
    softclips,
    hardclips,
    modifications,
    detectedModifications,
    regionStart,
    regionEnd,
    getReadIndex,
    showSoftClipping,
    statusCallback,
  })

  checkStopToken2(stopTokenCheck)

  const trackStrands =
    colorBy?.type === 'modifications' || colorBy?.type === 'methylation'

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
    trackStrands,
    regionSequence,
    regionSequenceStart,
    statusCallback,
    stopTokenCheck,
  })

  const insertSizeStats = computePairedInsertSizeStats(features)

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

    readTagColors: tagColors,

    ...buildCoverageResultFields(pipeline),

    maxY: 0,

    detectedModifications: Array.from(detectedModifications),
    simplexModifications: Array.from(detectedSimplexModifications),

    insertSizeStats,

    newTagValues: uniqueTagValues,
    sortTagValues,
    readNextRefs: nextRefs,
    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,

    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
  }

  return rpcResult(result, collectResultTransferables(result))
}
