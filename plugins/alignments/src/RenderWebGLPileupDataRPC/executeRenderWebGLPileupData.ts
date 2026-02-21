import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { max, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildTooltipData } from '../shared/buildTooltipData.ts'
import { calculateModificationCounts } from '../shared/calculateModificationCounts.ts'
import {
  computeCoverage,
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
  computeCoverageSegments,
  computeFrequenciesAndThresholds,
  extractFeatureTagValue,
  extractMethylation,
  extractMismatchData,
  extractModifications,
  fetchReferenceSequence,
} from '../shared/processFeatureAlignments.ts'
import { computeLayout, computeSortedLayout } from './sortLayout.ts'

import type { RenderWebGLPileupDataArgs, WebGLPileupDataResult } from './types'
import type { Mismatch } from '../shared/types'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
  SoftclipData,
} from '../shared/webglRpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface SnpCountEntry {
  baseCounts: Record<string, number>
  strandBaseCounts: Record<string, { fwd: number; rev: number }>
}

interface ModificationColorEntry {
  r: number
  g: number
  b: number
  probabilityTotal: number
  probabilityCount: number
  base: string
  isSimplex: boolean
}

type SortTagValuesMap = Map<string, string>

function computeModificationCoverage(
  modifications: ModificationEntry[],
  mismatches: MismatchData[],
  depths: Float32Array,
  regionMaxDepth: number,
  fwdDepths: Float32Array | undefined,
  revDepths: Float32Array | undefined,
  depthStartOffset: number,
  regionStart: number,
  regionSequence: string | undefined,
  regionSequenceStart: number,
) {
  if (modifications.length === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colors: new Uint8Array(0),
      count: 0,
    }
  }

  const snpByPosition = new Map<number, SnpCountEntry>()
  for (const mm of mismatches) {
    if (mm.position < regionStart) {
      continue
    }
    let entry = snpByPosition.get(mm.position)
    if (!entry) {
      entry = { baseCounts: {}, strandBaseCounts: {} }
      snpByPosition.set(mm.position, entry)
    }
    const base = String.fromCharCode(mm.base)
    entry.baseCounts[base] = (entry.baseCounts[base] ?? 0) + 1
    if (!entry.strandBaseCounts[base]) {
      entry.strandBaseCounts[base] = { fwd: 0, rev: 0 }
    }
    if (mm.strand === 1) {
      entry.strandBaseCounts[base].fwd++
    } else {
      entry.strandBaseCounts[base].rev++
    }
  }

  const byPosition = new Map<number, Map<string, ModificationColorEntry>>()

  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    let colorMap = byPosition.get(mod.position)
    if (!colorMap) {
      colorMap = new Map()
      byPosition.set(mod.position, colorMap)
    }
    const key = `${mod.r},${mod.g},${mod.b}`
    let entry = colorMap.get(key)
    if (!entry) {
      entry = {
        r: mod.r,
        g: mod.g,
        b: mod.b,
        probabilityTotal: 0,
        probabilityCount: 0,
        base: mod.base,
        isSimplex: mod.isSimplex,
      }
      colorMap.set(key, entry)
    }
    entry.probabilityTotal += mod.prob
    entry.probabilityCount++
  }

  const segments: {
    position: number
    yOffset: number
    height: number
    r: number
    g: number
    b: number
    alpha: number
  }[] = []

  for (const [position, colorMap] of byPosition) {
    const binIdx = Math.floor(position - regionStart - depthStartOffset)
    const depthAtPosition = depths[binIdx] ?? 0
    if (depthAtPosition === 0) {
      continue
    }

    const refbase = regionSequence
      ? (
          regionSequence[position - regionSequenceStart + 1] ?? 'N'
        ).toUpperCase()
      : 'N'

    const snpEntry = snpByPosition.get(position)
    const snpBaseCounts = snpEntry?.baseCounts ?? {}
    const snpStrandBaseCounts = snpEntry?.strandBaseCounts ?? {}

    const totalSnp = Object.values(snpBaseCounts).reduce((a, b) => a + b, 0)
    const refCount = Math.max(0, depthAtPosition - totalSnp)

    const baseCounts: Record<string, number> = { ...snpBaseCounts }
    baseCounts[refbase] = (baseCounts[refbase] ?? 0) + refCount

    const strandBaseCounts: Record<string, { fwd: number; rev: number }> = {}
    for (const [base, sc] of Object.entries(snpStrandBaseCounts)) {
      strandBaseCounts[base] = { ...sc }
    }

    if (fwdDepths && revDepths) {
      const fwdDepthAtPosition = fwdDepths[binIdx] ?? 0
      const revDepthAtPosition = revDepths[binIdx] ?? 0
      let snpFwd = 0
      let snpRev = 0
      for (const sc of Object.values(snpStrandBaseCounts)) {
        snpFwd += sc.fwd
        snpRev += sc.rev
      }
      const refFwd = Math.max(0, fwdDepthAtPosition - snpFwd)
      const refRev = Math.max(0, revDepthAtPosition - snpRev)
      if (!strandBaseCounts[refbase]) {
        strandBaseCounts[refbase] = { fwd: 0, rev: 0 }
      }
      strandBaseCounts[refbase].fwd += refFwd
      strandBaseCounts[refbase].rev += refRev
    } else {
      if (!strandBaseCounts[refbase]) {
        strandBaseCounts[refbase] = { fwd: 0, rev: 0 }
      }
      strandBaseCounts[refbase].fwd += refCount
    }

    let yOffset = 0
    for (const entry of colorMap.values()) {
      const { modifiable, detectable } = calculateModificationCounts({
        base: entry.base,
        isSimplex: entry.isSimplex,
        refbase,
        baseCounts,
        strandBaseCounts,
      })

      const modFraction =
        (modifiable / depthAtPosition) * (entry.probabilityTotal / detectable)
      const height = modFraction * (depthAtPosition / regionMaxDepth)

      const avgProbability =
        entry.probabilityCount > 0
          ? entry.probabilityTotal / entry.probabilityCount
          : 0

      if (!Number.isNaN(height)) {
        segments.push({
          position,
          yOffset,
          height,
          r: entry.r,
          g: entry.g,
          b: entry.b,
          alpha: Math.round(avgProbability * 255),
        })
        yOffset += height
      }
    }
  }

  const positions = new Uint32Array(segments.length)
  const yOffsets = new Float32Array(segments.length)
  const heights = new Float32Array(segments.length)
  const colors = new Uint8Array(segments.length * 4)

  for (const [i, seg] of segments.entries()) {
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colors[i * 4] = seg.r
    colors[i * 4 + 1] = seg.g
    colors[i * 4 + 2] = seg.b
    colors[i * 4 + 3] = seg.alpha
  }

  return { positions, yOffsets, heights, colors, count: segments.length }
}

export async function executeRenderWebGLPileupData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLPileupDataArgs
}) {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
    colorBy,
    colorTagMap,
    sortedBy,
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
  } = await updateStatus('Processing alignments', statusCallback, async () => {
    const featuresData: FeatureData[] = []
    const gapsData: GapData[] = []
    const mismatchesData: MismatchData[] = []
    const insertionsData: InsertionData[] = []
    const softclipsData: SoftclipData[] = []
    const hardclipsData: HardclipData[] = []
    const modificationsData: ModificationEntry[] = []
    const tagColorValues: string[] = []
    const isTagColorMode = colorBy?.type === 'tag' && colorBy.tag && colorTagMap
    const sortTagValues: SortTagValuesMap | undefined =
      sortedBy?.type === 'tag' && sortedBy.tag
        ? new Map<string, string>()
        : undefined

    for (const feature of featuresArray) {
      const featureId = feature.id()
      const featureStart = feature.get('start')
      const strand = feature.get('strand')

      featuresData.push(buildBaseFeatureData(feature))

      if (isTagColorMode) {
        tagColorValues.push(extractFeatureTagValue(feature, colorBy.tag!))
      }

      if (sortTagValues) {
        const val = extractFeatureTagValue(feature, sortedBy!.tag!)
        if (val !== '') {
          sortTagValues.set(featureId, val)
        }
      }

      const featureMismatches = feature.get('mismatches') as
        | Mismatch[]
        | undefined
      if (featureMismatches) {
        extractMismatchData(
          featureMismatches, featureId, featureStart, strand, feature,
          gapsData, mismatchesData, insertionsData, softclipsData, hardclipsData,
        )
      }

      extractModifications(
        feature, featureId, featureStart, strand, colorBy,
        detectedModifications, detectedSimplexModifications, modificationsData,
      )

      if (colorBy?.type === 'methylation' && regionSequence) {
        extractMethylation(
          feature, featureId, featureStart, strand,
          regionSequence, regionSequenceStart,
          regionStart, Math.ceil(region.end), modificationsData,
        )
      }
    }

    const readTagColors =
      isTagColorMode
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
      sortTagValues,
    }
  })

  checkStopToken2(stopTokenCheck)

  const regionEnd = Math.ceil(region.end)

  const {
    maxY,
    readArrays,
    gapArrays,
    mismatchArrays,
    interbaseArrays,
    modificationArrays,
  } = await updateStatus('Computing layout', statusCallback, async () => {
    const layout = sortedBy
      ? computeSortedLayout(
          features,
          mismatches,
          gaps,
          { insertions, softclips, hardclips },
          sortTagValues,
          sortedBy,
        )
      : computeLayout(features)
    const numLevels = max(layout.values(), 0) + 1
    const getY = (id: string) => layout.get(id) ?? 0

    const readPositions = new Uint32Array(features.length * 2)
    const readYs = new Uint16Array(features.length)
    const readFlags = new Uint16Array(features.length)
    const readMapqs = new Uint8Array(features.length)
    const readInsertSizes = new Float32Array(features.length)
    const readPairOrientations = new Uint8Array(features.length)
    const readStrands = new Int8Array(features.length)
    const readIds: string[] = []
    const readNames: string[] = []

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
      readIds.push(f.id)
      readNames.push(f.name)
    }

    return {
      maxY: numLevels,
      readArrays: {
        readPositions, readYs, readFlags, readMapqs,
        readInsertSizes, readPairOrientations, readStrands,
        readIds, readNames,
      },
      gapArrays: buildGapArrays(gaps, regionStart, getY),
      mismatchArrays: buildMismatchArrays(mismatches, regionStart, getY),
      interbaseArrays: buildInterbaseArrays(
        insertions, softclips, hardclips, regionStart, getY,
      ),
      modificationArrays: buildModificationArrays(modifications, regionStart, getY),
    }
  })

  checkStopToken2(stopTokenCheck)

  const trackStrands = colorBy?.type === 'modifications'
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () =>
      computeCoverage(features, gaps, regionStart, regionEnd, trackStrands),
  )

  checkStopToken2(stopTokenCheck)

  const { mismatchFrequencies, interbaseFrequencies, gapFrequencies } =
    computeFrequenciesAndThresholds(
      mismatchArrays, interbaseArrays, gapArrays,
      coverage.depths, coverage.startOffset,
    )

  const { snpCoverage, noncovCoverage } = computeCoverageSegments(
    mismatches, insertions, softclips, hardclips,
    coverage.maxDepth, regionStart,
  )

  const modCoverage = computeModificationCoverage(
    modifications, mismatches,
    coverage.depths, coverage.maxDepth,
    coverage.fwdDepths, coverage.revDepths,
    coverage.startOffset, regionStart,
    regionSequence, regionSequenceStart,
  )

  const { tooltipData, significantSnpOffsets } = buildTooltipData({
    mismatches, insertions, gaps, softclips, hardclips,
    modifications, regionStart, coverage,
  })

  const sashimi = computeSashimiJunctions(gaps, regionStart)

  const pairedInsertSizes = features
    .filter(f => f.flags & 2 && !(f.flags & 256) && !(f.flags & 2048))
    .map(f => f.insertSize)

  const insertSizeStats =
    pairedInsertSizes.length > 0
      ? getInsertSizeStats(pairedInsertSizes)
      : undefined

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

    modCovPositions: modCoverage.positions,
    modCovYOffsets: modCoverage.yOffsets,
    modCovHeights: modCoverage.heights,
    modCovColors: modCoverage.colors,
    numModCovSegments: modCoverage.count,

    ...sashimi,

    tooltipData: Object.fromEntries(tooltipData),
    significantSnpOffsets,

    maxY,
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
  }

  const transferables = [
    result.readPositions.buffer,
    result.readYs.buffer,
    result.readFlags.buffer,
    result.readMapqs.buffer,
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
  ] as ArrayBuffer[]

  return rpcResult(result, transferables)
}
