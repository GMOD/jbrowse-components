import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildModTooltipData } from '../shared/buildTooltipData.ts'
import {
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '../shared/samFlags.ts'
import {
  computeCoverage,
  computeNoncovCoverage,
  computeSNPCoverage,
  computeSashimiJunctions,
} from '../shared/computeCoverage.ts'
import { computeModificationCoverage } from '../shared/computeModificationCoverage.ts'
import { extractFeatureArrays } from '../shared/extractFeatureArrays.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import { packCoverageAreaForGpu } from '../shared/packCoverageArea.ts'
import {
  buildBaseFeatureData,
  buildGapArrays,
  buildInterbaseArrays,
  buildMismatchArrays,
  buildModificationArrays,
  buildSegmentArrays,
  buildSoftclipBaseArrays,
  computeFrequenciesAndThresholds,
  fetchReferenceSequence,
} from '../shared/processFeatureAlignments.ts'

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
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () =>
      computeCoverage(features, gaps, regionStart, regionEnd, trackStrands),
  )

  checkStopToken2(stopTokenCheck)

  const { mismatchFrequencies, interbaseFrequencies, gapFrequencies } =
    computeFrequenciesAndThresholds(
      mismatchArrays,
      interbaseArrays,
      gapArrays,
      coverage.depths,
      coverage.startPos,
    )

  const snpCoverage = computeSNPCoverage(
    mismatches,
    coverage.maxDepth,
    regionStart,
  )
  const noncovCoverage = computeNoncovCoverage(
    insertions,
    softclips,
    hardclips,
    coverage.maxDepth,
    regionStart,
    coverage.depths,
    coverage.startPos,
  )

  const modCoverage = computeModificationCoverage(
    modifications,
    mismatches,
    coverage.depths,
    coverage.maxDepth,
    coverage.fwdDepths,
    coverage.revDepths,
    coverage.startPos,
    regionStart,
    regionSequence,
    regionSequenceStart,
  )

  const modTooltipData = buildModTooltipData({ modifications, regionStart })

  const sashimi = computeSashimiJunctions(gaps)

  const PRIMARY_PROPER_PAIR_MASK =
    SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY
  const pairedInsertSizes: number[] = []
  for (const f of features) {
    if (f.flags & SAM_FLAG_PROPER_PAIR && !(f.flags & PRIMARY_PROPER_PAIR_MASK)) {
      pairedInsertSizes.push(f.insertSize)
    }
  }

  const insertSizeStats =
    pairedInsertSizes.length > 0
      ? getInsertSizeStats(pairedInsertSizes)
      : undefined

  const coverageAreaPacked = packCoverageAreaForGpu(
    coverage,
    snpCoverage,
    noncovCoverage,
    modCoverage,
  )

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

    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageStartPos: coverage.startPos,

    snpPositions: snpCoverage.positions,
    snpYOffsets: snpCoverage.yOffsets,
    snpHeights: snpCoverage.heights,
    snpColorTypes: snpCoverage.colorTypes,

    noncovPositions: noncovCoverage.positions,
    noncovYOffsets: noncovCoverage.yOffsets,
    noncovHeights: noncovCoverage.heights,
    noncovColorTypes: noncovCoverage.colorTypes,
    noncovMaxCount: noncovCoverage.maxCount,

    indicatorPositions: noncovCoverage.indicatorPositions,
    indicatorColorTypes: noncovCoverage.indicatorColorTypes,

    modCovPositions: modCoverage.positions,
    modCovYOffsets: modCoverage.yOffsets,
    modCovHeights: modCoverage.heights,
    modCovColors: modCoverage.colors,
    numModCovSegments: modCoverage.count,

    ...coverageAreaPacked,

    ...sashimi,

    modTooltipData,

    maxY: 0,
    numReads: features.length,
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInterbases: interbaseArrays.interbasePositions.length,
    numCoverageBins: coverage.depths.length,
    numModifications: modificationArrays.modificationPositions.length,
    numSnpSegments: snpCoverage.count,
    numNoncovSegments: noncovCoverage.segmentCount,

    detectedModifications: Array.from(detectedModifications),
    simplexModifications: Array.from(detectedSimplexModifications),
    numIndicators: noncovCoverage.indicatorCount,

    insertSizeStats,

    newTagValues: uniqueTagValues,
    sortTagValues,
    readNextRefs: nextRefs,
    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,
  }

  const transferables = [
    result.readPositions.buffer,
    result.readYs.buffer,
    result.segmentPositions.buffer,
    result.segmentReadIndices.buffer,
    result.segmentEdgeFlags.buffer,
    result.readFlags.buffer,
    result.readMapqs.buffer,
    result.readAvgBaseQualities.buffer,
    result.readInsertSizes.buffer,
    result.readPairOrientations.buffer,
    result.readStrands.buffer,
    result.gapPositions.buffer,
    result.gapYs.buffer,
    result.gapLengths.buffer,
    result.gapTypes.buffer,
    result.gapFrequencies.buffer,
    result.mismatchPositions.buffer,
    result.mismatchYs.buffer,
    result.mismatchBases.buffer,
    result.mismatchStrands.buffer,
    result.mismatchFrequencies.buffer,
    result.softclipBasePositions.buffer,
    result.softclipBaseYs.buffer,
    result.softclipBaseBases.buffer,
    result.interbasePositions.buffer,
    result.interbaseYs.buffer,
    result.interbaseLengths.buffer,
    result.interbaseTypes.buffer,
    result.interbaseFrequencies.buffer,
    result.coverageDepths.buffer,
    result.snpPositions.buffer,
    result.snpYOffsets.buffer,
    result.snpHeights.buffer,
    result.snpColorTypes.buffer,
    result.noncovPositions.buffer,
    result.noncovYOffsets.buffer,
    result.noncovHeights.buffer,
    result.noncovColorTypes.buffer,
    result.indicatorPositions.buffer,
    result.indicatorColorTypes.buffer,
    result.modificationPositions.buffer,
    result.modificationYs.buffer,
    result.modificationColors.buffer,
    ...(result.modificationProbabilities
      ? [result.modificationProbabilities.buffer]
      : []),
    result.modCovPositions.buffer,
    result.modCovYOffsets.buffer,
    result.modCovHeights.buffer,
    result.modCovColors.buffer,
    result.readTagColors.buffer,
    result.sashimiX1.buffer,
    result.sashimiX2.buffer,
    result.sashimiScores.buffer,
    result.sashimiColorTypes.buffer,
    result.sashimiCounts.buffer,
    result.readNextPositions!.buffer,
    // Worker-packed GPU buffers (see ADR-004 + packCoverageArea.ts).
    result.coveragePackedBuffer,
    result.snpPackedBuffer,
    result.noncovPackedBuffer,
    result.indicatorPackedBuffer,
    result.modCovPackedBuffer,
    result.gapReadIndices.buffer,
    result.mismatchReadIndices.buffer,
    result.softclipBaseReadIndices.buffer,
    result.interbaseReadIndices.buffer,
    result.modificationReadIndices.buffer,
    ...(result.modificationTypeIndices
      ? [result.modificationTypeIndices.buffer]
      : []),
  ] as ArrayBuffer[]

  return rpcResult(result, transferables)
}
