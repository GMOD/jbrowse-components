import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, groupBy, max, min, updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildTooltipData } from '../shared/buildTooltipData.ts'
import { PairType, getPairedType } from '../shared/color.ts'
import {
  computeCoverage,
  computeNoncovCoverage,
  computeSNPCoverage,
  computeSashimiJunctions,
} from '../shared/computeCoverage.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import {
  buildBaseFeatureData,
  buildGapArrays,
  buildInterbaseArrays,
  buildMismatchArrays,
  buildModificationArrays,
  buildTagColors,
  computeFrequenciesAndThresholds,
  extractFeatureTagValue,
  extractMethylation,
  extractMismatchData,
  extractModifications,
  fetchReferenceSequence,
} from '../shared/processFeatureAlignments.ts'

import type {
  RenderWebGLPileupDataArgs,
  WebGLPileupDataResult,
} from '../RenderWebGLPileupDataRPC/types.ts'
import type { Mismatch } from '../shared/types'
import type { ChainStats } from '../shared/types.ts'
import type {
  ChainFeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from '../shared/webglRpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface ExecuteParams {
  pluginManager: PluginManager
  args: RenderWebGLChainDataArgs
}

export interface RenderWebGLChainDataArgs extends RenderWebGLPileupDataArgs {
  drawSingletons?: boolean
  drawProperPairs?: boolean
}

function getColorType(f: ChainFeatureData, stats?: ChainStats) {
  const pairType = getPairedType({
    type: 'insertSizeAndOrientation',
    f: {
      refName: f.refName,
      next_ref: f.nextRef,
      pair_orientation: f.pairOrientationStr,
      tlen: f.templateLength,
      flags: f.flags,
    },
    stats,
  })

  switch (pairType) {
    case PairType.LONG_INSERT:
      return 1
    case PairType.SHORT_INSERT:
      return 2
    case PairType.INTER_CHROM:
      return 3
    case PairType.ABNORMAL_ORIENTATION:
      return 4
    default:
      return 0
  }
}

function computeChainLayout(
  chains: { minStart: number; maxEnd: number; distance: number }[],
) {
  const sorted = chains
    .map((c, i) => ({ ...c, idx: i }))
    .sort((a, b) => a.distance - b.distance)
  const layout = new GranularRectLayout({ pitchX: 1, pitchY: 1 })
  const layoutMap = new Map<number, number>()

  for (const chain of sorted) {
    const top = layout.addRect(
      String(chain.idx),
      chain.minStart,
      chain.maxEnd + 2,
      1,
    )
    layoutMap.set(chain.idx, top ?? 0)
  }

  return layoutMap
}

export async function executeRenderWebGLChainData({
  pluginManager,
  args,
}: ExecuteParams) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    colorBy,
    colorTagMap,
    drawSingletons = true,
    drawProperPairs = true,
    statusCallback = () => {},
    stopToken,
  } = args

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  const regionWithAssembly = {
    ...region,
    assemblyName: region.assemblyName ?? '',
  }

  const featuresArray = await firstValueFrom(
    dataAdapter.getFeatures(regionWithAssembly, args).pipe(toArray()),
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
      regionWithAssembly,
      region,
      featuresArray,
      regionStart,
    })
    regionSequence = result.regionSequence
    regionSequenceStart = result.regionSequenceStart
  }

  const detectedModifications = new Set<string>()
  const detectedSimplexModifications = new Set<string>()

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
  } = await updateStatus('Processing alignments', statusCallback, async () => {
    const featuresData: ChainFeatureData[] = []
    const gapsData: GapData[] = []
    const mismatchesData: MismatchData[] = []
    const insertionsData: InsertionData[] = []
    const softclipsData: SoftclipData[] = []
    const hardclipsData: HardclipData[] = []
    const modificationsData: ModificationEntry[] = []
    const tagColorValues: string[] = []
    const isTagColorMode = colorBy?.type === 'tag' && colorBy.tag && colorTagMap

    for (const feature of keptFeatures) {
      const featureId = feature.id()
      const featureStart = feature.get('start')
      const strand = feature.get('strand')

      featuresData.push({
        ...buildBaseFeatureData(feature),
        refName: feature.get('refName'),
        nextRef: feature.get('next_ref'),
        pairOrientationStr: feature.get('pair_orientation'),
        templateLength: feature.get('template_length') ?? 0,
      })

      if (isTagColorMode) {
        tagColorValues.push(extractFeatureTagValue(feature, colorBy.tag!))
      }

      const featureMismatches = feature.get('mismatches') as
        | Mismatch[]
        | undefined
      if (featureMismatches) {
        extractMismatchData(
          featureMismatches,
          featureId,
          featureStart,
          strand,
          feature,
          gapsData,
          mismatchesData,
          insertionsData,
          softclipsData,
          hardclipsData,
        )
      }

      extractModifications(
        feature,
        featureId,
        featureStart,
        strand,
        colorBy,
        detectedModifications,
        detectedSimplexModifications,
        modificationsData,
      )

      if (colorBy?.type === 'methylation' && regionSequence) {
        extractMethylation(
          feature,
          featureId,
          featureStart,
          strand,
          regionSequence,
          regionSequenceStart,
          regionStart,
          Math.ceil(region.end),
          modificationsData,
        )
      }
    }

    const readTagColors = isTagColorMode
      ? buildTagColors(featuresData, tagColorValues, colorBy, colorTagMap)
      : new Uint8Array(0)

    modificationsData.sort((a, b) => a.modType.localeCompare(b.modType))

    return {
      features: featuresData,
      gaps: gapsData,
      mismatches: mismatchesData,
      insertions: insertionsData,
      softclips: softclipsData,
      hardclips: hardclipsData,
      modifications: modificationsData,
      tagColors: readTagColors,
    }
  })

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

  const chainBounds: {
    minStart: number
    maxEnd: number
    distance: number
    chainIdx: number
  }[] = []

  for (const [chainIdx, chain] of chains.entries()) {
    let minStart = Number.MAX_VALUE
    let maxEnd = Number.MIN_VALUE
    for (const f of chain) {
      if (f.start < minStart) {
        minStart = f.start
      }
      if (f.end > maxEnd) {
        maxEnd = f.end
      }
    }

    let distance = maxEnd - minStart
    if (chain.length === 1) {
      const tlen = Math.abs(chain[0]!.templateLength || 0)
      if (tlen > 0) {
        distance = tlen
      }
    }

    chainBounds.push({ minStart, maxEnd, distance, chainIdx })
  }

  const featureIdToY = new Map<string, number>()
  let maxY = 0

  const {
    readArrays,
    gapArrays,
    mismatchArrays,
    interbaseArrays,
    modificationArrays,
    connectingLineArrays,
    chainFlatbushData,
    chainFirstReadIndices,
  } = await updateStatus('Computing chain layout', statusCallback, async () => {
    const chainLayout = computeChainLayout(chainBounds)
    for (const cb of chainBounds) {
      const row = chainLayout.get(cb.chainIdx) ?? 0
      const chain = chains[cb.chainIdx]!
      for (const f of chain) {
        featureIdToY.set(f.id, row)
      }
      if (row > maxY) {
        maxY = row
      }
    }
    maxY += 1

    const chainHasSupp = new Set<number>()
    for (const [chainIdx, chain] of chains.entries()) {
      for (const f of chain) {
        if (f.flags & 2048) {
          chainHasSupp.add(chainIdx)
          break
        }
      }
    }

    const featureIdToChainIdx = new Map<string, number>()
    for (const [chainIdx, chain] of chains.entries()) {
      for (const f of chain) {
        featureIdToChainIdx.set(f.id, chainIdx)
      }
    }

    const getY = (id: string) => featureIdToY.get(id) ?? 0

    const readPositions = new Uint32Array(features.length * 2)
    const readYs = new Uint16Array(features.length)
    const readFlags = new Uint16Array(features.length)
    const readMapqs = new Uint8Array(features.length)
    const readInsertSizes = new Float32Array(features.length)
    const readPairOrientations = new Uint8Array(features.length)
    const readStrands = new Int8Array(features.length)
    const readChainHasSupp = new Uint8Array(features.length)
    const readIds: string[] = []
    const readNames: string[] = []
    const readNextRefs: string[] = []

    for (const [i, f] of features.entries()) {
      const y = getY(f.id)
      readPositions[i * 2] = Math.max(0, f.start - regionStart)
      readPositions[i * 2 + 1] = f.end - regionStart
      readYs[i] = y
      readFlags[i] = f.flags
      readMapqs[i] = Math.min(255, f.mapq)
      readInsertSizes[i] = f.insertSize
      readPairOrientations[i] = f.pairOrientation
      readStrands[i] = f.strand
      const cIdx = featureIdToChainIdx.get(f.id)
      readChainHasSupp[i] = cIdx !== undefined && chainHasSupp.has(cIdx) ? 1 : 0
      readIds.push(f.id)
      readNames.push(f.name)
      readNextRefs.push(f.nextRef ?? '')
    }

    const connectingLines: {
      start: number
      end: number
      y: number
      colorType: number
    }[] = []
    for (const cb of chainBounds) {
      const chain = chains[cb.chainIdx]!
      if (chain.length < 2) {
        continue
      }
      const y = getY(chain[0]!.id)
      const colorType = chainHasSupp.has(cb.chainIdx)
        ? 5
        : getColorType(chain[0]!, chainStats)
      connectingLines.push({
        start: Math.max(0, cb.minStart - regionStart),
        end: cb.maxEnd - regionStart,
        y,
        colorType,
      })
    }

    const connectingLinePositions = new Uint32Array(connectingLines.length * 2)
    const connectingLineYs = new Uint16Array(connectingLines.length)
    const connectingLineColorTypes = new Uint8Array(connectingLines.length)
    for (const [i, line] of connectingLines.entries()) {
      connectingLinePositions[i * 2] = line.start
      connectingLinePositions[i * 2 + 1] = line.end
      connectingLineYs[i] = line.y
      connectingLineColorTypes[i] = line.colorType
    }

    const featureIdToIndex = new Map<string, number>()
    for (const [i, f] of features.entries()) {
      if (!featureIdToIndex.has(f.id)) {
        featureIdToIndex.set(f.id, i)
      }
    }

    let chainFlatbushData: ArrayBuffer | undefined
    const chainFirstReadIndices = new Uint32Array(chainBounds.length)
    if (chainBounds.length > 0) {
      const flatbush = new Flatbush(chainBounds.length)
      for (const [i, cb] of chainBounds.entries()) {
        const chain = chains[cb.chainIdx]!
        const y = getY(chain[0]!.id)
        flatbush.add(
          Math.max(0, cb.minStart - regionStart),
          y,
          cb.maxEnd - regionStart,
          y,
        )
        chainFirstReadIndices[i] = featureIdToIndex.get(chain[0]!.id) ?? 0
      }
      flatbush.finish()
      chainFlatbushData = flatbush.data
    }

    return {
      readArrays: {
        readPositions,
        readYs,
        readFlags,
        readMapqs,
        readInsertSizes,
        readPairOrientations,
        readStrands,
        readChainHasSupp,
        readIds,
        readNames,
        readNextRefs,
      },
      gapArrays: buildGapArrays(gaps, regionStart, getY),
      mismatchArrays: buildMismatchArrays(mismatches, regionStart, getY),
      interbaseArrays: buildInterbaseArrays(
        insertions,
        softclips,
        hardclips,
        regionStart,
        getY,
      ),
      modificationArrays: buildModificationArrays(
        modifications,
        regionStart,
        getY,
      ),
      connectingLineArrays: {
        connectingLinePositions,
        connectingLineYs,
        connectingLineColorTypes,
        numConnectingLines: connectingLines.length,
      },
      chainFlatbushData,
      chainFirstReadIndices,
    }
  })

  checkStopToken2(stopTokenCheck)

  const regionEnd = Math.ceil(region.end)

  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () => computeCoverage(features, gaps, regionStart, regionEnd),
  )

  checkStopToken2(stopTokenCheck)

  const { mismatchFrequencies, interbaseFrequencies, gapFrequencies } =
    computeFrequenciesAndThresholds(
      mismatchArrays,
      interbaseArrays,
      gapArrays,
      coverage.depths,
      coverage.startOffset,
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
  )

  const sashimi = computeSashimiJunctions(gaps, regionStart)

  const { tooltipData, significantSnpOffsets } = buildTooltipData({
    mismatches,
    insertions,
    gaps,
    softclips,
    hardclips,
    modifications,
    regionStart,
    coverage,
  })

  const result: WebGLPileupDataResult = {
    regionStart,

    ...readArrays,
    ...gapArrays,
    gapFrequencies,
    ...mismatchArrays,
    mismatchFrequencies,
    ...interbaseArrays,
    interbaseFrequencies,
    ...modificationArrays,

    readTagColors: tagColors,
    numTagColors: tagColors.length / 3,

    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageBinSize: coverage.binSize,
    coverageStartOffset: coverage.startOffset,

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

    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint8Array(0),
    numModCovSegments: 0,

    ...sashimi,

    tooltipData: Object.fromEntries(tooltipData),
    significantSnpOffsets,

    ...connectingLineArrays,

    chainFlatbushData,
    chainFirstReadIndices,

    maxY,
    numReads: features.length,
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInterbases: interbaseArrays.interbasePositions.length,
    numCoverageBins: coverage.depths.length,
    numModifications: modificationArrays.modificationPositions.length,
    numSnpSegments: snpCoverage.count,
    numNoncovSegments: noncovCoverage.segmentCount,
    numIndicators: noncovCoverage.indicatorCount,

    detectedModifications: Array.from(detectedModifications),
    simplexModifications: Array.from(detectedSimplexModifications),

    insertSizeStats: chainStats,
  }

  const transferables = [
    result.readPositions.buffer,
    result.readYs.buffer,
    result.readFlags.buffer,
    result.readMapqs.buffer,
    result.readInsertSizes.buffer,
    result.readChainHasSupp!.buffer,
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
    result.connectingLinePositions!.buffer,
    result.connectingLineYs!.buffer,
    result.connectingLineColorTypes!.buffer,
    result.chainFirstReadIndices!.buffer,
    ...(result.chainFlatbushData ? [result.chainFlatbushData] : []),
  ] as ArrayBuffer[]

  return rpcResult(result, transferables)
}
