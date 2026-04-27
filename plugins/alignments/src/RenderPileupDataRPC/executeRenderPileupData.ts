import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildCoverageResultFields } from '../shared/buildCoverageResultFields.ts'
import { collectResultTransferables } from '../shared/collectTransferables.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import {
  buildBaseFeatureData,
  buildGapArrays,
  buildInterbaseArrays,
  buildMismatchArrays,
  buildModificationArrays,
  buildSegmentArrays,
  buildSoftclipBaseArrays,
  fetchReferenceSequence,
} from '../shared/processFeatureAlignments.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'
import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '../shared/samFlags.ts'

import type { PileupDataResult, RenderPileupDataArgs } from './types'
import type { FilterBy } from '../shared/types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'

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

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  const fetchOpts: BaseOptions & { filterBy?: FilterBy } = {
    stopToken,
    filterBy,
    statusCallback,
  }
  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(region, fetchOpts).pipe(toArray()),
  )

  checkStopToken2(stopTokenCheck)

  const regionStart = Math.floor(region.start)

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
  const {
    readArrays,
    gapArrays,
    mismatchArrays,
    softclipBaseArrays,
    interbaseArrays,
    modificationArrays,
    segmentArrays,
  } = await updateStatus('Building arrays', statusCallback, async () => {
    const featureIdToIndex = new Map<string, number>()
    const getReadIndex = (id: string) => featureIdToIndex.get(id)!

    const readPositions = new Uint32Array(features.length * 2)
    const readYs = new Uint16Array(features.length)
    const readFlags = new Uint16Array(features.length)
    const readMapqs = new Uint8Array(features.length)
    const readAvgBaseQualities = new Uint8Array(features.length)
    const readInsertSizes = new Float32Array(features.length)
    const readPairOrientations = new Uint8Array(features.length)
    const readStrands = new Int8Array(features.length)
    const readIds: string[] = []
    const readNames: string[] = []

    for (let i = 0; i < features.length; i++) {
      const f = features[i]!
      featureIdToIndex.set(f.id, i)
      readPositions[i * 2] = Math.max(regionStart, f.start)
      readPositions[i * 2 + 1] = f.end
      readFlags[i] = f.flags
      readMapqs[i] = Math.min(255, f.mapq)
      readAvgBaseQualities[i] = Math.min(255, f.avgBaseQuality)
      readInsertSizes[i] = f.insertSize
      readPairOrientations[i] = f.pairOrientation
      readStrands[i] = f.strand
      readIds.push(f.id)
      readNames.push(f.name)
    }

    return {
      readArrays: {
        readPositions,
        readYs,
        readFlags,
        readMapqs,
        readAvgBaseQualities,
        readInsertSizes,
        readPairOrientations,
        readStrands,
        readIds,
        readNames,
      },
      gapArrays: buildGapArrays(gaps, regionStart, getReadIndex),
      mismatchArrays: buildMismatchArrays(
        mismatches,
        regionStart,
        getReadIndex,
      ),
      softclipBaseArrays: buildSoftclipBaseArrays(
        showSoftClipping ? softclips : [],
        regionStart,
        getReadIndex,
      ),
      interbaseArrays: buildInterbaseArrays(
        insertions,
        softclips,
        hardclips,
        regionStart,
        getReadIndex,
      ),
      modificationArrays: buildModificationArrays(
        modifications,
        regionStart,
        getReadIndex,
        detectedModifications,
      ),
      segmentArrays: buildSegmentArrays(
        features,
        gaps,
        regionStart,
        regionEnd,
        getReadIndex,
      ),
    }
  })

  checkStopToken2(stopTokenCheck)

  const trackStrands =
    colorBy?.type === 'modifications' || colorBy?.type === 'methylation'

  const {
    coverage,
    snpCoverage,
    noncovCoverage,
    modCoverage,
    modTooltipData,
    sashimi,
    coverageAreaPacked,
    mismatchFrequencies,
    interbaseFrequencies,
    gapFrequencies,
  } = await runCoveragePipeline({
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

  const PRIMARY_PROPER_PAIR_MASK = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY
  const pairedInsertSizes: number[] = []
  for (const f of features) {
    if (
      f.flags & SAM_FLAG_PROPER_PAIR &&
      !(f.flags & PRIMARY_PROPER_PAIR_MASK)
    ) {
      pairedInsertSizes.push(f.insertSize)
    }
  }

  const insertSizeStats =
    pairedInsertSizes.length > 0
      ? getInsertSizeStats(pairedInsertSizes)
      : undefined

  const result: PileupDataResult = {
    ...readArrays,
    ...segmentArrays,
    ...gapArrays,
    gapFrequencies,
    ...mismatchArrays,
    mismatchFrequencies,
    ...softclipBaseArrays,
    numSoftclipBases: softclipBaseArrays.softclipBasePositions.length,
    ...interbaseArrays,
    interbaseFrequencies,
    ...modificationArrays,

    readTagColors: tagColors,

    ...buildCoverageResultFields(
      coverage,
      snpCoverage,
      noncovCoverage,
      coverageAreaPacked,
      sashimi,
      modTooltipData,
      modCoverage,
    ),

    maxY: 0,
    numReads: features.length,
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInterbases: interbaseArrays.interbasePositions.length,
    numModifications: modificationArrays.modificationPositions.length,

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
    numConnectingLines: 0,
  }

  return rpcResult(result, collectResultTransferables(result))
}
