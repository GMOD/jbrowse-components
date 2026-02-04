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

  // Store positions as offsets from regionStart
  const positions = new Uint32Array(segments.length)
  const yOffsets = new Float32Array(segments.length)
  const heights = new Float32Array(segments.length)
  const colorTypes = new Uint8Array(segments.length)

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  return { positions, yOffsets, heights, colorTypes, count: segments.length }
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
        readPositions[i * 2] = f.start - regionStart
        readPositions[i * 2 + 1] = f.end - regionStart
        readYs[i] = y
        readFlags[i] = f.flags
        readMapqs[i] = Math.min(255, f.mapq)
        readInsertSizes[i] = f.insertSize
      }

      const gapPositions = new Uint32Array(gaps.length * 2)
      const gapYs = new Uint16Array(gaps.length)
      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i]
        const y = layout.get(g.featureId) ?? 0
        gapPositions[i * 2] = g.start - regionStart
        gapPositions[i * 2 + 1] = g.end - regionStart
        gapYs[i] = y
      }

      const mismatchPositions = new Uint32Array(mismatches.length)
      const mismatchYs = new Uint16Array(mismatches.length)
      const mismatchBases = new Uint8Array(mismatches.length)
      for (let i = 0; i < mismatches.length; i++) {
        const mm = mismatches[i]
        const y = layout.get(mm.featureId) ?? 0
        mismatchPositions[i] = mm.position - regionStart
        mismatchYs[i] = y
        mismatchBases[i] = mm.base
      }

      const insertionPositions = new Uint32Array(insertions.length)
      const insertionYs = new Uint16Array(insertions.length)
      const insertionLengths = new Uint16Array(insertions.length)
      for (let i = 0; i < insertions.length; i++) {
        const ins = insertions[i]
        const y = layout.get(ins.featureId) ?? 0
        insertionPositions[i] = ins.position - regionStart
        insertionYs[i] = y
        insertionLengths[i] = Math.min(65535, ins.length)
      }

      const softclipPositions = new Uint32Array(softclips.length)
      const softclipYs = new Uint16Array(softclips.length)
      const softclipLengths = new Uint16Array(softclips.length)
      for (let i = 0; i < softclips.length; i++) {
        const sc = softclips[i]
        const y = layout.get(sc.featureId) ?? 0
        softclipPositions[i] = sc.position - regionStart
        softclipYs[i] = y
        softclipLengths[i] = Math.min(65535, sc.length)
      }

      const hardclipPositions = new Uint32Array(hardclips.length)
      const hardclipYs = new Uint16Array(hardclips.length)
      const hardclipLengths = new Uint16Array(hardclips.length)
      for (let i = 0; i < hardclips.length; i++) {
        const hc = hardclips[i]
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

    maxY,
    numReads: features.length,
    numGaps: gaps.length,
    numMismatches: mismatches.length,
    numInsertions: insertions.length,
    numSoftclips: softclips.length,
    numHardclips: hardclips.length,
    numCoverageBins: coverage.depths.length,
    numSnpSegments: snpCoverage.count,
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
  ]

  return rpcResult(result, transferables)
}
