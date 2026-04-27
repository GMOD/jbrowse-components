import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, groupBy, max, min, updateStatus } from '@jbrowse/core/util'
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
} from '../shared/processFeatureAlignments.ts'
import { runCoveragePipeline } from '../shared/runCoveragePipeline.ts'

import type { RenderChainDataArgs } from './types.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'
import type { ChainStats, FilterBy } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
    tagColors,
    uniqueTagValues,
    nextPositions,
    suppAlignments,
    detectedModifications,
    detectedSimplexModifications,
  } = await updateStatus('Processing alignments', statusCallback, async () =>
    extractFeatureArrays(
      keptFeatures,
      feature => ({
        ...buildBaseFeatureData(feature),
        refName: feature.get('refName'),
        nextRef: feature.get('next_ref') as string | undefined,
        pairOrientationStr: feature.get('pair_orientation') as
          | string
          | undefined,
        templateLength:
          (feature.get('template_length') as number | undefined) ?? 0,
      }),
      { colorBy, colorTagMap, showSoftClipping: false, region, regionStart },
    ),
  )

  checkStopToken2(stopTokenCheck)

  const featuresByName = groupBy(features, f => f.name)
  const chains = Object.values(featuresByName)

  const tlens: number[] = []
  for (const f of features) {
    if (f.flags & 2 && !(f.flags & 256) && !(f.flags & 2048)) {
      const tlen = f.templateLength
      if (tlen !== 0 && !Number.isNaN(tlen)) {
        tlens.push(Math.abs(tlen))
      }
    }
  }

  let chainStats: ChainStats | undefined
  if (tlens.length > 0) {
    const insertSizeStats = getInsertSizeStats(tlens)
    chainStats = {
      ...insertSizeStats,
      max: max(tlens),
      min: min(tlens),
    }
  }

  const numChains = chains.length

  // Per-chain metadata — layout is computed on the main thread so that chains
  // spanning multiple displayedRegions get consistent row assignments.
  const chainAbsMinStarts = new Uint32Array(numChains)
  const chainAbsMaxEnds = new Uint32Array(numChains)
  const chainDistances = new Uint32Array(numChains)
  const chainNames: string[] = []
  // Worker-local: drives readChainHasSupp below. Not transferred to main.
  const chainSuppTypes = new Uint8Array(numChains)
  const chainHasMultiple = new Uint8Array(numChains)
  const chainFirstReadIndices = new Uint32Array(numChains)

  const featureIdToChainIdx = new Map<string, number>()
  for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
    const chain = chains[chainIdx]!
    let minStart = Number.MAX_VALUE
    let maxEnd = Number.MIN_VALUE
    let hasSupp = false
    let primaryStrand = 1
    for (const f of chain) {
      if (f.start < minStart) {
        minStart = f.start
      }
      if (f.end > maxEnd) {
        maxEnd = f.end
      }
      if (f.flags & 2048) {
        hasSupp = true
      } else {
        primaryStrand = f.flags & 16 ? -1 : 1
      }
      featureIdToChainIdx.set(f.id, chainIdx)
    }
    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.templateLength || 0)
      if (tlen > 0) {
        distance = tlen
      }
    }
    chainAbsMinStarts[chainIdx] = minStart
    chainAbsMaxEnds[chainIdx] = maxEnd
    chainDistances[chainIdx] = distance
    chainNames.push(chain[0]!.name)
    chainSuppTypes[chainIdx] = hasSupp ? (primaryStrand === -1 ? 2 : 1) : 0
    chainHasMultiple[chainIdx] = chain.length >= 2 ? 1 : 0
  }

  // Build read arrays with y=0; layout fills real values on the main thread.
  const readPositions = new Uint32Array(features.length * 2)
  const readYs = new Uint16Array(features.length)
  const readFlags = new Uint16Array(features.length)
  const readMapqs = new Uint8Array(features.length)
  const readAvgBaseQualities = new Uint8Array(features.length)
  const readInsertSizes = new Float32Array(features.length)
  const readPairOrientations = new Uint8Array(features.length)
  const readStrands = new Int8Array(features.length)
  const readChainHasSupp = new Uint8Array(features.length)
  const readIds: string[] = []
  const readNames: string[] = []
  const readNextRefs: string[] = []
  const readChainIndices = new Uint32Array(features.length)
  const featureIdToIndex = new Map<string, number>()
  const chainFirstReadSeen = new Uint8Array(numChains)

  for (let i = 0; i < features.length; i++) {
    const f = features[i]!
    const cIdx = featureIdToChainIdx.get(f.id) ?? 0
    readPositions[i * 2] = Math.max(regionStart, f.start)
    readPositions[i * 2 + 1] = f.end
    readYs[i] = 0
    readFlags[i] = f.flags
    readMapqs[i] = Math.min(255, f.mapq)
    readAvgBaseQualities[i] = Math.min(255, f.avgBaseQuality)
    readInsertSizes[i] = f.insertSize
    readPairOrientations[i] = f.pairOrientation
    readStrands[i] = f.strand
    readChainHasSupp[i] = chainSuppTypes[cIdx] ? 1 : 0
    readChainIndices[i] = cIdx
    readIds.push(f.id)
    readNames.push(f.name)
    readNextRefs.push(f.nextRef ?? '')
    if (!chainFirstReadSeen[cIdx]) {
      chainFirstReadSeen[cIdx] = 1
      chainFirstReadIndices[cIdx] = i
    }
    featureIdToIndex.set(f.id, i)
  }

  const getReadIndex = (id: string) => featureIdToIndex.get(id)!

  const regionEnd = Math.ceil(region.end)

  // Layout Ys are filled by the main thread (see computeChainLayout.ts);
  // the worker emits zero-filled Y arrays here.
  const {
    gapArrays,
    mismatchArrays,
    interbaseArrays,
    modificationArrays,
    segmentArrays,
  } = await updateStatus(
    'Building alignment arrays',
    statusCallback,
    async () => ({
      gapArrays: buildGapArrays(gaps, regionStart, getReadIndex),
      mismatchArrays: buildMismatchArrays(
        mismatches,
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
    }),
  )

  checkStopToken2(stopTokenCheck)

  // Chain omits regionSequence so runCoveragePipeline skips mod-coverage and
  // packCoverageAreaForGpu emits a 0-byte mod-cov pass.
  const {
    coverage,
    snpCoverage,
    noncovCoverage,
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
    statusCallback,
    stopTokenCheck,
  })

  const result: PileupDataResult = {
    readPositions,
    readYs,
    readFlags,
    readMapqs,
    readAvgBaseQualities,
    readInsertSizes,
    readPairOrientations,
    readStrands,
    readChainHasSupp,
    readIds,
    readNames,
    readNextRefs,
    readChainIndices,
    ...segmentArrays,
    ...gapArrays,
    gapFrequencies,
    ...mismatchArrays,
    mismatchFrequencies,
    ...interbaseArrays,
    interbaseFrequencies,
    ...modificationArrays,

    softclipBasePositions: new Uint32Array(0),
    softclipBaseYs: new Uint16Array(0),
    softclipBaseBases: new Uint8Array(0),
    softclipBaseReadIndices: new Uint32Array(0),
    numSoftclipBases: 0,

    readTagColors: tagColors,

    ...buildCoverageResultFields(
      coverage,
      snpCoverage,
      noncovCoverage,
      coverageAreaPacked,
      sashimi,
      modTooltipData,
    ),

    chainAbsMinStarts,
    chainAbsMaxEnds,
    chainDistances,
    chainNames,
    chainHasMultiple,
    chainFirstReadIndices,

    maxY: 0,
    numReads: features.length,
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInterbases: interbaseArrays.interbasePositions.length,
    numModifications: modificationArrays.modificationPositions.length,

    detectedModifications: Array.from(detectedModifications),
    simplexModifications: Array.from(detectedSimplexModifications),

    insertSizeStats: chainStats,

    newTagValues: uniqueTagValues,
    readNextPositions: new Uint32Array(nextPositions),
    readSuppAlignments: suppAlignments,

    connectingLinePositions: new Uint32Array(0),
    connectingLineYs: new Uint16Array(0),
    numConnectingLines: 0,
  }

  return rpcResult(result, collectResultTransferables(result))
}
