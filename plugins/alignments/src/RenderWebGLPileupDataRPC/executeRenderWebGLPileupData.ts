import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type { RenderWebGLPileupDataArgs, WebGLPileupDataResult } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Mismatch } from '../shared/types'

interface FeatureData {
  id: string
  start: number
  end: number
  flags: number
  mapq: number
  insertSize: number
}

interface GapData {
  featureId: string
  start: number
  end: number
}

interface MismatchData {
  featureId: string
  position: number
  base: number
}

interface InsertionData {
  featureId: string
  position: number
  length: number
}

interface SoftclipData {
  featureId: string
  position: number
  length: number
}

interface HardclipData {
  featureId: string
  position: number
  length: number
}

function baseToNum(base: string): number {
  switch (base.toUpperCase()) {
    case 'A':
      return 0
    case 'C':
      return 1
    case 'G':
      return 2
    case 'T':
      return 3
    default:
      return 0
  }
}

function computeLayout(features: FeatureData[]): Map<string, number> {
  const sorted = [...features].sort((a, b) => a.start - b.start)
  const levels: number[] = []
  const layoutMap = new Map<string, number>()

  for (const feature of sorted) {
    let y = 0
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] <= feature.start) {
        y = i
        break
      }
      y = i + 1
    }
    layoutMap.set(feature.id, y)
    levels[y] = feature.end + 2
  }

  return layoutMap
}

function computeCoverage(
  features: FeatureData[],
  regionStart: number,
  regionEnd: number,
): { depths: Float32Array; maxDepth: number; binSize: number } {
  if (features.length === 0) {
    return {
      depths: new Float32Array(0),
      maxDepth: 0,
      binSize: 1,
    }
  }

  const regionLength = regionEnd - regionStart
  const maxBins = 10000
  const binSize = Math.max(1, Math.ceil(regionLength / maxBins))
  const numBins = Math.ceil(regionLength / binSize)

  const events: { pos: number; delta: number }[] = []
  for (const f of features) {
    events.push({ pos: f.start, delta: 1 })
    events.push({ pos: f.end, delta: -1 })
  }
  events.sort((a, b) => a.pos - b.pos)

  const depths = new Float32Array(numBins)

  let currentDepth = 0
  let eventIdx = 0

  for (let binIdx = 0; binIdx < numBins; binIdx++) {
    const binEnd = regionStart + (binIdx + 1) * binSize
    while (eventIdx < events.length && events[eventIdx].pos < binEnd) {
      currentDepth += events[eventIdx].delta
      eventIdx++
    }
    depths[binIdx] = currentDepth
  }

  let maxDepth = 1
  for (let i = 0; i < depths.length; i++) {
    if (depths[i] > maxDepth) {
      maxDepth = depths[i]
    }
  }

  return { depths, maxDepth, binSize }
}

interface SNPCoverageEntry {
  position: number
  a: number
  c: number
  g: number
  t: number
}

interface NoncovCoverageEntry {
  position: number
  insertion: number
  softclip: number
  hardclip: number
}

function computeSNPCoverage(
  mismatches: MismatchData[],
  maxDepth: number,
  regionStart: number,
): {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  count: number
} {
  if (mismatches.length === 0 || maxDepth === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      count: 0,
    }
  }

  const snpByPosition = new Map<number, SNPCoverageEntry>()
  for (const mm of mismatches) {
    let entry = snpByPosition.get(mm.position)
    if (!entry) {
      entry = { position: mm.position, a: 0, c: 0, g: 0, t: 0 }
      snpByPosition.set(mm.position, entry)
    }
    if (mm.base === 0) {
      entry.a++
    } else if (mm.base === 1) {
      entry.c++
    } else if (mm.base === 2) {
      entry.g++
    } else if (mm.base === 3) {
      entry.t++
    }
  }

  const segments: { position: number; yOffset: number; height: number; colorType: number }[] = []

  for (const entry of snpByPosition.values()) {
    const total = entry.a + entry.c + entry.g + entry.t
    if (total === 0) {
      continue
    }

    let yOffset = 0

    if (entry.a > 0) {
      const height = entry.a / maxDepth
      segments.push({ position: entry.position, yOffset, height, colorType: 1 })
      yOffset += height
    }

    if (entry.c > 0) {
      const height = entry.c / maxDepth
      segments.push({ position: entry.position, yOffset, height, colorType: 2 })
      yOffset += height
    }

    if (entry.g > 0) {
      const height = entry.g / maxDepth
      segments.push({ position: entry.position, yOffset, height, colorType: 3 })
      yOffset += height
    }

    if (entry.t > 0) {
      const height = entry.t / maxDepth
      segments.push({ position: entry.position, yOffset, height, colorType: 4 })
    }
  }

  // Filter to only include positions at or after regionStart (avoid Uint32 underflow)
  const filteredSegments = segments.filter(seg => seg.position >= regionStart)

  // Store positions as offsets from regionStart
  const positions = new Uint32Array(filteredSegments.length)
  const yOffsets = new Float32Array(filteredSegments.length)
  const heights = new Float32Array(filteredSegments.length)
  const colorTypes = new Uint8Array(filteredSegments.length)

  for (let i = 0; i < filteredSegments.length; i++) {
    const seg = filteredSegments[i]
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  return { positions, yOffsets, heights, colorTypes, count: filteredSegments.length }
}

// Minimum read depth to show indicators (below this the statistical significance is low)
const MINIMUM_INDICATOR_READ_DEPTH = 7
// Default threshold for showing indicators (fraction of coverage)
const INDICATOR_THRESHOLD = 0.3

function computeNoncovCoverage(
  insertions: InsertionData[],
  softclips: SoftclipData[],
  hardclips: HardclipData[],
  maxDepth: number,
  regionStart: number,
): {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  maxCount: number
  segmentCount: number
  indicatorCount: number
} {
  const noncovByPosition = new Map<number, NoncovCoverageEntry>()

  for (const ins of insertions) {
    let entry = noncovByPosition.get(ins.position)
    if (!entry) {
      entry = { position: ins.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(ins.position, entry)
    }
    entry.insertion++
  }

  for (const sc of softclips) {
    let entry = noncovByPosition.get(sc.position)
    if (!entry) {
      entry = { position: sc.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(sc.position, entry)
    }
    entry.softclip++
  }

  for (const hc of hardclips) {
    let entry = noncovByPosition.get(hc.position)
    if (!entry) {
      entry = { position: hc.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(hc.position, entry)
    }
    entry.hardclip++
  }

  if (noncovByPosition.size === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      indicatorPositions: new Uint32Array(0),
      indicatorColorTypes: new Uint8Array(0),
      maxCount: 0,
      segmentCount: 0,
      indicatorCount: 0,
    }
  }

  // Find max total count for scaling
  let maxCount = 1
  for (const entry of noncovByPosition.values()) {
    const total = entry.insertion + entry.softclip + entry.hardclip
    if (total > maxCount) {
      maxCount = total
    }
  }

  // Build segments (stacked bars) and indicators
  const segments: { position: number; yOffset: number; height: number; colorType: number }[] = []
  const indicators: { position: number; colorType: number }[] = []

  for (const entry of noncovByPosition.values()) {
    const total = entry.insertion + entry.softclip + entry.hardclip
    if (total === 0) {
      continue
    }

    let yOffset = 0

    // Order: insertion (purple), softclip (grey), hardclip (dark grey)
    if (entry.insertion > 0) {
      const height = entry.insertion / maxCount
      segments.push({ position: entry.position, yOffset, height, colorType: 1 })
      yOffset += height
    }

    if (entry.softclip > 0) {
      const height = entry.softclip / maxCount
      segments.push({ position: entry.position, yOffset, height, colorType: 2 })
      yOffset += height
    }

    if (entry.hardclip > 0) {
      const height = entry.hardclip / maxCount
      segments.push({ position: entry.position, yOffset, height, colorType: 3 })
    }

    // Add indicator if significant
    if (maxDepth >= MINIMUM_INDICATOR_READ_DEPTH && total > maxDepth * INDICATOR_THRESHOLD) {
      // Determine dominant type for indicator color
      let dominantType = 1 // insertion
      let dominantCount = entry.insertion
      if (entry.softclip > dominantCount) {
        dominantType = 2
        dominantCount = entry.softclip
      }
      if (entry.hardclip > dominantCount) {
        dominantType = 3
      }
      indicators.push({ position: entry.position, colorType: dominantType })
    }
  }

  // Filter to only include positions at or after regionStart (avoid Uint32 underflow)
  const filteredSegments = segments.filter(seg => seg.position >= regionStart)
  const filteredIndicators = indicators.filter(ind => ind.position >= regionStart)

  const positions = new Uint32Array(filteredSegments.length)
  const yOffsets = new Float32Array(filteredSegments.length)
  const heights = new Float32Array(filteredSegments.length)
  const colorTypes = new Uint8Array(filteredSegments.length)

  for (let i = 0; i < filteredSegments.length; i++) {
    const seg = filteredSegments[i]
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  const indicatorPositions = new Uint32Array(filteredIndicators.length)
  const indicatorColorTypes = new Uint8Array(filteredIndicators.length)

  for (let i = 0; i < filteredIndicators.length; i++) {
    const ind = filteredIndicators[i]
    indicatorPositions[i] = ind.position - regionStart
    indicatorColorTypes[i] = ind.colorType
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    indicatorPositions,
    indicatorColorTypes,
    maxCount,
    segmentCount: filteredSegments.length,
    indicatorCount: filteredIndicators.length,
  }
}

export async function executeRenderWebGLPileupData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLPileupDataArgs
}): Promise<WebGLPileupDataResult> {
  const {
    sessionId,
    adapterConfig,
    sequenceAdapter,
    region,
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

  const featuresArray = await updateStatus(
    'Fetching alignments',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(region, args).pipe(toArray()),
      ),
  )

  checkStopToken2(stopTokenCheck)

  const { features, gaps, mismatches, insertions, softclips, hardclips } = await updateStatus(
    'Processing alignments',
    statusCallback,
    async () => {
      const deduped = dedupe(featuresArray, (f: Feature) => f.id())

      const featuresData: FeatureData[] = []
      const gapsData: GapData[] = []
      const mismatchesData: MismatchData[] = []
      const insertionsData: InsertionData[] = []
      const softclipsData: SoftclipData[] = []
      const hardclipsData: HardclipData[] = []

      for (const feature of deduped) {
        const featureId = feature.id()
        const featureStart = feature.get('start')

        featuresData.push({
          id: featureId,
          start: featureStart,
          end: feature.get('end'),
          flags: feature.get('flags') ?? 0,
          mapq: feature.get('score') ?? feature.get('qual') ?? 60,
          insertSize: Math.abs(feature.get('template_length') ?? 400),
        })

        const featureMismatches = feature.get('mismatches') as
          | Mismatch[]
          | undefined
        if (featureMismatches) {
          for (const mm of featureMismatches) {
            if (mm.type === 'deletion' || mm.type === 'skip') {
              gapsData.push({
                featureId,
                start: featureStart + mm.start,
                end: featureStart + mm.start + mm.length,
              })
            } else if (mm.type === 'mismatch') {
              mismatchesData.push({
                featureId,
                position: featureStart + mm.start,
                base: baseToNum(mm.base),
              })
            } else if (mm.type === 'insertion') {
              insertionsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.insertlen ?? mm.length,
              })
            } else if (mm.type === 'softclip') {
              softclipsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.cliplen ?? mm.length,
              })
            } else if (mm.type === 'hardclip') {
              hardclipsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.cliplen ?? mm.length,
              })
            }
          }
        }
      }

      return {
        features: featuresData,
        gaps: gapsData,
        mismatches: mismatchesData,
        insertions: insertionsData,
        softclips: softclipsData,
        hardclips: hardclipsData,
      }
    },
  )

  checkStopToken2(stopTokenCheck)

  // Use region.start as reference point - all positions stored as offsets
  const regionStart = region.start

  const { maxY, readArrays, gapArrays, mismatchArrays, insertionArrays, softclipArrays, hardclipArrays } =
    await updateStatus('Computing layout', statusCallback, async () => {
      const layout = computeLayout(features)
      const numLevels = Math.max(0, ...layout.values()) + 1

      // Positions stored as offsets from regionStart for Float32 precision
      const readPositions = new Uint32Array(features.length * 2)
      const readYs = new Uint16Array(features.length)
      const readFlags = new Uint16Array(features.length)
      const readMapqs = new Uint8Array(features.length)
      const readInsertSizes = new Float32Array(features.length)

      for (let i = 0; i < features.length; i++) {
        const f = features[i]
        const y = layout.get(f.id) ?? 0
        // Clamp start to 0 to avoid Uint32 underflow for reads that start before regionStart
        readPositions[i * 2] = Math.max(0, f.start - regionStart)
        readPositions[i * 2 + 1] = f.end - regionStart
        readYs[i] = y
        readFlags[i] = f.flags
        readMapqs[i] = Math.min(255, f.mapq)
        readInsertSizes[i] = f.insertSize
      }

      // Filter gaps to only include those at or after regionStart (avoid Uint32 underflow)
      const filteredGaps = gaps.filter(g => g.start >= regionStart)
      const gapPositions = new Uint32Array(filteredGaps.length * 2)
      const gapYs = new Uint16Array(filteredGaps.length)
      for (let i = 0; i < filteredGaps.length; i++) {
        const g = filteredGaps[i]
        const y = layout.get(g.featureId) ?? 0
        gapPositions[i * 2] = g.start - regionStart
        gapPositions[i * 2 + 1] = g.end - regionStart
        gapYs[i] = y
      }

      // Filter mismatches to only include those at or after regionStart (avoid Uint32 underflow)
      const filteredMismatches = mismatches.filter(mm => mm.position >= regionStart)
      const mismatchPositions = new Uint32Array(filteredMismatches.length)
      const mismatchYs = new Uint16Array(filteredMismatches.length)
      const mismatchBases = new Uint8Array(filteredMismatches.length)
      for (let i = 0; i < filteredMismatches.length; i++) {
        const mm = filteredMismatches[i]
        const y = layout.get(mm.featureId) ?? 0
        mismatchPositions[i] = mm.position - regionStart
        mismatchYs[i] = y
        mismatchBases[i] = mm.base
      }

      // Filter insertions to only include those at or after regionStart (avoid Uint32 underflow)
      const filteredInsertions = insertions.filter(ins => ins.position >= regionStart)
      const insertionPositions = new Uint32Array(filteredInsertions.length)
      const insertionYs = new Uint16Array(filteredInsertions.length)
      const insertionLengths = new Uint16Array(filteredInsertions.length)
      for (let i = 0; i < filteredInsertions.length; i++) {
        const ins = filteredInsertions[i]
        const y = layout.get(ins.featureId) ?? 0
        insertionPositions[i] = ins.position - regionStart
        insertionYs[i] = y
        insertionLengths[i] = Math.min(65535, ins.length)
      }

      // Filter softclips to only include those at or after regionStart (avoid Uint32 underflow)
      const filteredSoftclips = softclips.filter(sc => sc.position >= regionStart)
      const softclipPositions = new Uint32Array(filteredSoftclips.length)
      const softclipYs = new Uint16Array(filteredSoftclips.length)
      const softclipLengths = new Uint16Array(filteredSoftclips.length)
      for (let i = 0; i < filteredSoftclips.length; i++) {
        const sc = filteredSoftclips[i]
        const y = layout.get(sc.featureId) ?? 0
        softclipPositions[i] = sc.position - regionStart
        softclipYs[i] = y
        softclipLengths[i] = Math.min(65535, sc.length)
      }

      // Filter hardclips to only include those at or after regionStart (avoid Uint32 underflow)
      const filteredHardclips = hardclips.filter(hc => hc.position >= regionStart)
      const hardclipPositions = new Uint32Array(filteredHardclips.length)
      const hardclipYs = new Uint16Array(filteredHardclips.length)
      const hardclipLengths = new Uint16Array(filteredHardclips.length)
      for (let i = 0; i < filteredHardclips.length; i++) {
        const hc = filteredHardclips[i]
        const y = layout.get(hc.featureId) ?? 0
        hardclipPositions[i] = hc.position - regionStart
        hardclipYs[i] = y
        hardclipLengths[i] = Math.min(65535, hc.length)
      }

      return {
        maxY: numLevels,
        readArrays: { readPositions, readYs, readFlags, readMapqs, readInsertSizes },
        gapArrays: { gapPositions, gapYs },
        mismatchArrays: { mismatchPositions, mismatchYs, mismatchBases },
        insertionArrays: { insertionPositions, insertionYs, insertionLengths },
        softclipArrays: { softclipPositions, softclipYs, softclipLengths },
        hardclipArrays: { hardclipPositions, hardclipYs, hardclipLengths },
      }
    })

  checkStopToken2(stopTokenCheck)

  const coverage = await updateStatus('Computing coverage', statusCallback, async () =>
    computeCoverage(features, region.start, region.end),
  )

  checkStopToken2(stopTokenCheck)

  const snpCoverage = computeSNPCoverage(mismatches, coverage.maxDepth, regionStart)

  const noncovCoverage = computeNoncovCoverage(
    insertions,
    softclips,
    hardclips,
    coverage.maxDepth,
    regionStart,
  )

  const result: WebGLPileupDataResult = {
    regionStart,

    ...readArrays,
    ...gapArrays,
    ...mismatchArrays,
    ...insertionArrays,
    ...softclipArrays,
    ...hardclipArrays,

    coverageDepths: coverage.depths,
    coverageMaxDepth: coverage.maxDepth,
    coverageBinSize: coverage.binSize,

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

    maxY,
    numReads: features.length,
    // Use actual array lengths (may be filtered to exclude positions before regionStart)
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInsertions: insertionArrays.insertionPositions.length,
    numSoftclips: softclipArrays.softclipPositions.length,
    numHardclips: hardclipArrays.hardclipPositions.length,
    numCoverageBins: coverage.depths.length,
    numSnpSegments: snpCoverage.count,
    numNoncovSegments: noncovCoverage.segmentCount,
    numIndicators: noncovCoverage.indicatorCount,
  }

  const transferables: ArrayBuffer[] = [
    result.readPositions.buffer,
    result.readYs.buffer,
    result.readFlags.buffer,
    result.readMapqs.buffer,
    result.readInsertSizes.buffer,
    result.gapPositions.buffer,
    result.gapYs.buffer,
    result.mismatchPositions.buffer,
    result.mismatchYs.buffer,
    result.mismatchBases.buffer,
    result.insertionPositions.buffer,
    result.insertionYs.buffer,
    result.insertionLengths.buffer,
    result.softclipPositions.buffer,
    result.softclipYs.buffer,
    result.softclipLengths.buffer,
    result.hardclipPositions.buffer,
    result.hardclipYs.buffer,
    result.hardclipLengths.buffer,
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
  ]

  return rpcResult(result, transferables)
}
