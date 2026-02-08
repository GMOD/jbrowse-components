/**
 * WebGL Pileup Data RPC Executor
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * All position data in this module uses integer coordinates. View region bounds
 * (region.start, region.end) can be fractional from scrolling/zooming, so we
 * convert to integers: regionStart = floor(region.start), regionEnd = ceil(region.end).
 * All positions are then stored as integer offsets from regionStart. This ensures
 * consistent alignment between coverage bins, gap positions, and rendered features.
 */

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { parseCigar2 } from '../MismatchParser/index.ts'
import { getMethBins } from '../ModificationParser/getMethBins.ts'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition.ts'
import { getColorForModification, getTagAlt } from '../util.ts'

import type { RenderWebGLPileupDataArgs, WebGLPileupDataResult } from './types'
import type { Mismatch } from '../shared/types'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface FeatureData {
  id: string
  start: number
  end: number
  flags: number
  mapq: number
  insertSize: number
  pairOrientation: number // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
  strand: number // -1=reverse, 0=unknown, 1=forward
}

interface GapData {
  featureId: string
  start: number
  end: number
  type: 'deletion' | 'skip' // distinguish between deletions and intron skips
}

interface MismatchData {
  featureId: string
  position: number
  base: number
  strand: number // -1=reverse, 1=forward
}

interface InsertionData {
  featureId: string
  position: number
  length: number
  sequence?: string
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

interface ModificationEntry {
  featureId: string
  position: number // absolute genomic position
  r: number
  g: number
  b: number
  a: number // alpha from probability
}

// Parse "rgb(r,g,b)" string to [r,g,b]
function parseRgbColor(color: string): [number, number, number] {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color)
  if (match) {
    return [+match[1]!, +match[2]!, +match[3]!]
  }
  // Fallback for hex or named colors - return grey
  return [128, 128, 128]
}

function baseToAscii(base: string): number {
  return base.toUpperCase().charCodeAt(0)
}

// Pair orientation encoding for shader
// Based on orientationTypes from util.ts - maps pair_orientation strings to integers
// Supports 'fr' orientation type (most common for Illumina)
function pairOrientationToNum(pairOrientation: string | undefined): number {
  if (!pairOrientation) {
    return 0 // unknown
  }
  // For 'fr' orientation type (standard Illumina):
  // F1R2, F2R1 -> LR (normal)
  // R1F2, R2F1 -> RL
  // F1F2, F2F1 -> RR (actually FF)
  // R1R2, R2R1 -> LL (actually RR)
  switch (pairOrientation) {
    case 'F1R2':
    case 'F2R1':
      return 1 // LR - normal
    case 'R1F2':
    case 'R2F1':
      return 2 // RL
    case 'F1F2':
    case 'F2F1':
      return 3 // RR (FF orientation)
    case 'R1R2':
    case 'R2R1':
      return 4 // LL (RR orientation)
    default:
      return 0 // unknown
  }
}

function computeLayout(features: FeatureData[]): Map<string, number> {
  const sorted = [...features].sort((a, b) => a.start - b.start)
  const levels: number[] = []
  const layoutMap = new Map<string, number>()

  for (const feature of sorted) {
    let y = 0
    for (const [i, level] of levels.entries()) {
      if (level <= feature.start) {
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

/**
 * Compute coverage depth across a region, accounting for deletions/skips.
 *
 * Coverage extends to the maximum feature end position to ensure reads that
 * extend beyond the requested region still have coverage computed for their
 * full extent (so grey bars appear under the full read extent).
 *
 * @param features - Array of reads with absolute integer start/end positions
 * @param gaps - Array of deletions/skips with absolute integer start/end positions
 * @param regionStart - Integer start position (use Math.floor of view region)
 * @param regionEnd - Integer end position (use Math.ceil of view region)
 * @returns Coverage depths per bin, with bin[i] representing position regionStart + i*binSize
 */
function computeCoverage(
  features: FeatureData[],
  gaps: GapData[],
  regionStart: number,
  regionEnd: number,
): {
  depths: Float32Array
  maxDepth: number
  binSize: number
  startOffset: number
} {
  if (features.length === 0) {
    return {
      depths: new Float32Array(0),
      maxDepth: 0,
      binSize: 1,
      startOffset: 0,
    }
  }

  // Extend region to cover the extent of features, but limit to 3x the
  // requested region size to avoid pathological cases (e.g., reads spanning
  // entire genomes could create massive coverage arrays)
  const requestedLength = regionEnd - regionStart
  const maxExtension = requestedLength // Allow 1x extension on each side (3x total)
  let actualStart = regionStart
  let actualEnd = regionEnd
  for (const f of features) {
    if (f.start < actualStart && f.start >= regionStart - maxExtension) {
      actualStart = f.start
    }
    if (f.end > actualEnd && f.end <= regionEnd + maxExtension) {
      actualEnd = f.end
    }
  }

  // startOffset is the offset from regionStart where coverage bins begin
  // (negative if features extend before regionStart)
  const startOffset = actualStart - regionStart

  const regionLength = actualEnd - actualStart
  // Always use per-base coverage (binSize=1) for accurate display at all zoom levels.
  //
  // NOTE: Adaptive binning could be implemented here for performance with large regions:
  //   const maxBins = 10000
  //   const binSize = Math.max(1, Math.ceil(regionLength / maxBins))
  // However, this requires tracking binSize in the model's isWithinLoadedRegion check
  // to refetch at higher resolution when zooming in. The model would need to compare
  // current view width against loaded data's binSize and trigger refetch when the
  // view is small enough to benefit from binSize=1 (roughly visibleWidth < 2000bp
  // given the 2x expansion buffer on each side during fetch).
  const binSize = 1
  const numBins = regionLength

  const events: { pos: number; delta: number }[] = []
  for (const f of features) {
    events.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
  }
  for (const g of gaps) {
    events.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
  }
  events.sort((a, b) => a.pos - b.pos)

  const depths = new Float32Array(numBins)

  let currentDepth = 0
  let maxDepth = 0
  let eventIdx = 0

  for (let binIdx = 0; binIdx < numBins; binIdx++) {
    // Use actualStart (not regionStart) since bins cover [actualStart, actualEnd)
    const binEnd = actualStart + (binIdx + 1) * binSize
    while (eventIdx < events.length && events[eventIdx]!.pos < binEnd) {
      currentDepth += events[eventIdx]!.delta
      eventIdx++
    }
    depths[binIdx] = currentDepth
    if (currentDepth > maxDepth) {
      maxDepth = currentDepth
    }
  }

  return { depths, maxDepth: maxDepth || 1, binSize, startOffset }
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
    // mm.base is ASCII code: 65='A', 67='C', 71='G', 84='T'
    if (mm.base === 65) {
      entry.a++
    } else if (mm.base === 67) {
      entry.c++
    } else if (mm.base === 71) {
      entry.g++
    } else if (mm.base === 84) {
      entry.t++
    }
  }

  const segments: {
    position: number
    yOffset: number
    height: number
    colorType: number
  }[] = []

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

  for (const [i, seg] of filteredSegments.entries()) {
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    count: filteredSegments.length,
  }
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
  const segments: {
    position: number
    yOffset: number
    height: number
    colorType: number
  }[] = []
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
    if (
      maxDepth >= MINIMUM_INDICATOR_READ_DEPTH &&
      total > maxDepth * INDICATOR_THRESHOLD
    ) {
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
  const filteredIndicators = indicators.filter(
    ind => ind.position >= regionStart,
  )

  const positions = new Uint32Array(filteredSegments.length)
  const yOffsets = new Float32Array(filteredSegments.length)
  const heights = new Float32Array(filteredSegments.length)
  const colorTypes = new Uint8Array(filteredSegments.length)

  for (const [i, seg] of filteredSegments.entries()) {
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  const indicatorPositions = new Uint32Array(filteredIndicators.length)
  const indicatorColorTypes = new Uint8Array(filteredIndicators.length)

  for (const [i, ind] of filteredIndicators.entries()) {
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

function computeModificationCoverage(
  modifications: ModificationEntry[],
  maxDepth: number,
  regionStart: number,
): {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colors: Uint8Array
  count: number
} {
  if (modifications.length === 0 || maxDepth === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colors: new Uint8Array(0),
      count: 0,
    }
  }

  // Group by position → aggregate counts per unique color (r,g,b key)
  const byPosition = new Map<
    number,
    Map<string, { r: number; g: number; b: number; count: number }>
  >()

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
      entry = { r: mod.r, g: mod.g, b: mod.b, count: 0 }
      colorMap.set(key, entry)
    }
    entry.count++
  }

  // Build stacked segments
  const segments: {
    position: number
    yOffset: number
    height: number
    r: number
    g: number
    b: number
  }[] = []

  for (const [position, colorMap] of byPosition) {
    let yOffset = 0
    for (const entry of colorMap.values()) {
      const height = entry.count / maxDepth
      segments.push({
        position,
        yOffset,
        height,
        r: entry.r,
        g: entry.g,
        b: entry.b,
      })
      yOffset += height
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
    colors[i * 4 + 3] = 255
  }

  return {
    positions,
    yOffsets,
    heights,
    colors,
    count: segments.length,
  }
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

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Define integer bounds: floor for start (include first partially visible position),
  // ceil for end (include last partially visible position).
  // All position offsets throughout this function use regionStart as the reference point.
  const regionStart = Math.floor(region.start)

  // Fetch reference sequence for methylation coloring (requires CpG site detection)
  // Fetched with 1bp padding on each side so we can detect CpG dinucleotides
  // at region boundaries. The +1 offset in sequence indexing accounts for this.
  let regionSequence: string | undefined
  if (colorBy?.type === 'methylation' && sequenceAdapter) {
    const seqAdapter = (
      await getAdapter(pluginManager, sessionId, sequenceAdapter)
    ).dataAdapter as BaseFeatureDataAdapter
    const seqFeats = await firstValueFrom(
      seqAdapter
        .getFeatures({
          ...regionWithAssembly,
          refName: region.originalRefName || region.refName,
          start: Math.max(0, regionStart - 1),
          end: Math.ceil(region.end) + 1,
        })
        .pipe(toArray()),
    )
    regionSequence = seqFeats[0]?.get('seq')
  }

  const { features, gaps, mismatches, insertions, softclips, hardclips, modifications } =
    await updateStatus('Processing alignments', statusCallback, async () => {
      const deduped = dedupe(featuresArray, (f: Feature) => f.id())

      const featuresData: FeatureData[] = []
      const gapsData: GapData[] = []
      const mismatchesData: MismatchData[] = []
      const insertionsData: InsertionData[] = []
      const softclipsData: SoftclipData[] = []
      const hardclipsData: HardclipData[] = []
      const modificationsData: ModificationEntry[] = []
      for (const feature of deduped) {
        const featureId = feature.id()
        const featureStart = feature.get('start')

        const strand = feature.get('strand')
        featuresData.push({
          id: featureId,
          start: featureStart,
          end: feature.get('end'),
          flags: feature.get('flags') ?? 0,
          mapq: feature.get('score') ?? feature.get('qual') ?? 60,
          insertSize: Math.abs(feature.get('template_length') ?? 400),
          pairOrientation: pairOrientationToNum(
            feature.get('pair_orientation'),
          ),
          strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
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
                type: mm.type,
              })
            } else if (mm.type === 'mismatch') {
              mismatchesData.push({
                featureId,
                position: featureStart + mm.start,
                base: baseToAscii(mm.base ?? 'N'),
                strand: strand === -1 ? -1 : 1,
              })
            } else if (mm.type === 'insertion') {
              insertionsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.insertlen,
                sequence: mm.insertedBases,
              })
            } else if (mm.type === 'softclip') {
              softclipsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.cliplen,
              })
            } else {
              // hardclip
              hardclipsData.push({
                featureId,
                position: featureStart + mm.start,
                length: mm.cliplen,
              })
            }
          }
        }

        // Extract modifications from MM tag (only when color by modifications)
        if (colorBy?.type === 'modifications') {
          const mmTag = getTagAlt(feature, 'MM', 'Mm')
          if (mmTag) {
            const cigarString = feature.get('CIGAR') as string | undefined
            const seq = feature.get('seq') as string | undefined
            if (cigarString) {
              const cigarOps = parseCigar2(cigarString)
              const modThreshold =
                (colorBy.modifications?.threshold ?? 10) / 100
              const mods = getMaxProbModAtEachPosition(feature, cigarOps)
              if (mods) {
                // sparse array - use forEach
                // eslint-disable-next-line unicorn/no-array-for-each
                mods.forEach(({ prob, type }, refPos) => {
                  if (prob < modThreshold) {
                    return
                  }
                  const color = getColorForModification(type)
                  const [r, g, b] = parseRgbColor(color)
                  const alpha = Math.min(
                    255,
                    Math.round((prob * prob + 0.1) * 255),
                  )
                  modificationsData.push({
                    featureId,
                    position: featureStart + refPos,
                    r,
                    g,
                    b,
                    a: alpha,
                  })
                })
              }
            }
          }
        }

        // Extract methylation data (only when color by methylation)
        if (colorBy?.type === 'methylation' && regionSequence) {
          const cigarString = feature.get('CIGAR') as string | undefined
          if (cigarString) {
            const cigarOps = parseCigar2(cigarString)
            const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
              getMethBins(feature, cigarOps)

            const featureEnd = feature.get('end')
            const regionEnd = Math.ceil(region.end)
            const rSeq = regionSequence.toLowerCase()

            for (
              let i = Math.max(0, regionStart - featureStart);
              i < Math.min(featureEnd - featureStart, regionEnd - featureStart);
              i++
            ) {
              const j = i + featureStart
              const l1 = rSeq[j - regionStart + 1]
              const l2 = rSeq[j - regionStart + 2]

              if (l1 === 'c' && l2 === 'g') {
                // CpG site found - check for methylation at C position
                if (methBins[i]) {
                  const p = methProbs[i] || 0
                  // Red/blue gradient: red = methylated, blue = unmethylated
                  if (p > 0.5) {
                    const alpha = Math.round((p - 0.5) * 2 * 255)
                    modificationsData.push({
                      featureId,
                      position: j,
                      r: 255,
                      g: 0,
                      b: 0,
                      a: alpha,
                    })
                  } else {
                    const alpha = Math.round((1 - p * 2) * 255)
                    modificationsData.push({
                      featureId,
                      position: j,
                      r: 0,
                      g: 0,
                      b: 255,
                      a: alpha,
                    })
                  }
                } else {
                  // CpG site without modification data = unmethylated (blue)
                  modificationsData.push({
                    featureId,
                    position: j,
                    r: 0,
                    g: 0,
                    b: 255,
                    a: 255,
                  })
                }

                // Check G position for hydroxymethylation
                if (hydroxyMethBins[i + 1]) {
                  const p = hydroxyMethProbs[i + 1] || 0
                  if (p > 0.5) {
                    // Pink
                    const alpha = Math.round((p - 0.5) * 2 * 255)
                    modificationsData.push({
                      featureId,
                      position: j + 1,
                      r: 255,
                      g: 192,
                      b: 203,
                      a: alpha,
                    })
                  } else {
                    // Purple
                    const alpha = Math.round((1 - p * 2) * 255)
                    modificationsData.push({
                      featureId,
                      position: j + 1,
                      r: 128,
                      g: 0,
                      b: 128,
                      a: alpha,
                    })
                  }
                }
              }
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
        modifications: modificationsData,
      }
    })

  checkStopToken2(stopTokenCheck)

  const regionEnd = Math.ceil(region.end)

  const {
    maxY,
    readArrays,
    gapArrays,
    mismatchArrays,
    insertionArrays,
    softclipArrays,
    hardclipArrays,
    modificationArrays,
  } = await updateStatus('Computing layout', statusCallback, async () => {
    const layout = computeLayout(features)
    const numLevels = Math.max(0, ...layout.values()) + 1

    // Positions stored as offsets from regionStart for Float32 precision
    const readPositions = new Uint32Array(features.length * 2)
    const readYs = new Uint16Array(features.length)
    const readFlags = new Uint16Array(features.length)
    const readMapqs = new Uint8Array(features.length)
    const readInsertSizes = new Float32Array(features.length)
    const readPairOrientations = new Uint8Array(features.length)
    const readStrands = new Int8Array(features.length)
    const readIds: string[] = []

    for (const [i, f] of features.entries()) {
      const y = layout.get(f.id) ?? 0
      // Clamp start to 0 to avoid Uint32 underflow for reads that start before regionStart
      readPositions[i * 2] = Math.max(0, f.start - regionStart)
      readPositions[i * 2 + 1] = f.end - regionStart
      readYs[i] = y
      readFlags[i] = f.flags
      readMapqs[i] = Math.min(255, f.mapq)
      readInsertSizes[i] = f.insertSize
      readPairOrientations[i] = f.pairOrientation
      readStrands[i] = f.strand
      readIds.push(f.id)
    }

    // Filter gaps to only include those at or after regionStart (avoid Uint32 underflow)
    const filteredGaps = gaps.filter(g => g.start >= regionStart)
    const gapPositions = new Uint32Array(filteredGaps.length * 2)
    const gapYs = new Uint16Array(filteredGaps.length)
    const gapLengths = new Uint16Array(filteredGaps.length)
    const gapTypes = new Uint8Array(filteredGaps.length)
    for (const [i, g] of filteredGaps.entries()) {
      const y = layout.get(g.featureId) ?? 0
      gapPositions[i * 2] = g.start - regionStart
      gapPositions[i * 2 + 1] = g.end - regionStart
      gapYs[i] = y
      gapLengths[i] = Math.min(65535, g.end - g.start)
      gapTypes[i] = g.type === 'deletion' ? 0 : 1
    }

    // Filter mismatches to only include those at or after regionStart (avoid Uint32 underflow)
    const filteredMismatches = mismatches.filter(
      mm => mm.position >= regionStart,
    )
    const mismatchPositions = new Uint32Array(filteredMismatches.length)
    const mismatchYs = new Uint16Array(filteredMismatches.length)
    const mismatchBases = new Uint8Array(filteredMismatches.length)
    const mismatchStrands = new Int8Array(filteredMismatches.length)
    for (const [i, mm] of filteredMismatches.entries()) {
      const y = layout.get(mm.featureId) ?? 0
      mismatchPositions[i] = mm.position - regionStart
      mismatchYs[i] = y
      mismatchBases[i] = mm.base
      mismatchStrands[i] = mm.strand
    }

    // Filter insertions to only include those at or after regionStart (avoid Uint32 underflow)
    const filteredInsertions = insertions.filter(
      ins => ins.position >= regionStart,
    )
    const insertionPositions = new Uint32Array(filteredInsertions.length)
    const insertionYs = new Uint16Array(filteredInsertions.length)
    const insertionLengths = new Uint16Array(filteredInsertions.length)
    const insertionSequences: string[] = []
    for (const [i, ins] of filteredInsertions.entries()) {
      const y = layout.get(ins.featureId) ?? 0
      insertionPositions[i] = ins.position - regionStart
      insertionYs[i] = y
      insertionLengths[i] = Math.min(65535, ins.length)
      insertionSequences.push(ins.sequence ?? '')
    }

    // Filter softclips to only include those at or after regionStart (avoid Uint32 underflow)
    const filteredSoftclips = softclips.filter(sc => sc.position >= regionStart)
    const softclipPositions = new Uint32Array(filteredSoftclips.length)
    const softclipYs = new Uint16Array(filteredSoftclips.length)
    const softclipLengths = new Uint16Array(filteredSoftclips.length)
    for (const [i, sc] of filteredSoftclips.entries()) {
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
    for (const [i, hc] of filteredHardclips.entries()) {
      const y = layout.get(hc.featureId) ?? 0
      hardclipPositions[i] = hc.position - regionStart
      hardclipYs[i] = y
      hardclipLengths[i] = Math.min(65535, hc.length)
    }

    // Filter modifications to only include those at or after regionStart
    const filteredModifications = modifications.filter(
      m => m.position >= regionStart,
    )
    const modificationPositions = new Uint32Array(filteredModifications.length)
    const modificationYs = new Uint16Array(filteredModifications.length)
    const modificationColors = new Uint8Array(filteredModifications.length * 4)
    for (const [i, m] of filteredModifications.entries()) {
      const y = layout.get(m.featureId) ?? 0
      modificationPositions[i] = m.position - regionStart
      modificationYs[i] = y
      modificationColors[i * 4] = m.r
      modificationColors[i * 4 + 1] = m.g
      modificationColors[i * 4 + 2] = m.b
      modificationColors[i * 4 + 3] = m.a
    }

    return {
      maxY: numLevels,
      readArrays: {
        readPositions,
        readYs,
        readFlags,
        readMapqs,
        readInsertSizes,
        readPairOrientations,
        readStrands,
        readIds,
      },
      gapArrays: { gapPositions, gapYs, gapLengths, gapTypes },
      mismatchArrays: {
        mismatchPositions,
        mismatchYs,
        mismatchBases,
        mismatchStrands,
      },
      insertionArrays: {
        insertionPositions,
        insertionYs,
        insertionLengths,
        insertionSequences,
      },
      softclipArrays: { softclipPositions, softclipYs, softclipLengths },
      hardclipArrays: { hardclipPositions, hardclipYs, hardclipLengths },
      modificationArrays: {
        modificationPositions,
        modificationYs,
        modificationColors,
      },
    }
  })

  checkStopToken2(stopTokenCheck)

  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () => computeCoverage(features, gaps, regionStart, regionEnd),
  )

  checkStopToken2(stopTokenCheck)

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

  const modCoverage = computeModificationCoverage(
    modifications,
    coverage.maxDepth,
    regionStart,
  )

  // Build tooltip data for positions with SNPs or interbase events
  const tooltipData = new Map<
    number,
    {
      position: number
      depth: number
      snps: Record<string, { count: number; fwd: number; rev: number }>
      delskips: Record<
        string,
        { count: number; minLen: number; maxLen: number; avgLen: number }
      >
      interbase: Record<
        string,
        {
          count: number
          minLen: number
          maxLen: number
          avgLen: number
          topSeq?: string
        }
      >
    }
  >()

  // Process mismatches for SNP tooltip data
  for (const mm of mismatches) {
    if (mm.position < regionStart) {
      continue
    }
    const posOffset = mm.position - regionStart
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      // Find depth at this position from coverage bins
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: mm.position,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    // mm.base is ASCII code, convert to character
    const baseName = String.fromCharCode(mm.base)
    if (!bin.snps[baseName]) {
      bin.snps[baseName] = { count: 0, fwd: 0, rev: 0 }
    }
    bin.snps[baseName].count++
    if (mm.strand === 1) {
      bin.snps[baseName].fwd++
    } else {
      bin.snps[baseName].rev++
    }
  }

  // Process insertions for interbase tooltip data
  const insertionsByPos = new Map<
    number,
    { lengths: number[]; sequences: string[] }
  >()
  for (const ins of insertions) {
    if (ins.position < regionStart) {
      continue
    }
    const posOffset = ins.position - regionStart
    let data = insertionsByPos.get(posOffset)
    if (!data) {
      data = { lengths: [], sequences: [] }
      insertionsByPos.set(posOffset, data)
    }
    data.lengths.push(ins.length)
    if (ins.sequence) {
      data.sequences.push(ins.sequence)
    }
  }

  for (const [posOffset, data] of insertionsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...data.lengths)
    const maxLen = Math.max(...data.lengths)
    const avgLen = data.lengths.reduce((a, b) => a + b, 0) / data.lengths.length
    // Find most common sequence
    let topSeq: string | undefined
    if (data.sequences.length > 0) {
      const seqCounts = new Map<string, number>()
      for (const seq of data.sequences) {
        seqCounts.set(seq, (seqCounts.get(seq) ?? 0) + 1)
      }
      let maxCount = 0
      for (const [seq, count] of seqCounts) {
        if (count > maxCount) {
          maxCount = count
          topSeq = seq
        }
      }
    }
    bin.interbase.insertion = {
      count: data.lengths.length,
      minLen,
      maxLen,
      avgLen,
      topSeq,
    }
  }

  // Process deletions and skips for tooltip data
  // Deletions and skips span multiple positions, so we add counts to each position they cover
  const deletionsByPos = new Map<number, number[]>()
  const skipsByPos = new Map<number, number[]>()
  for (const gap of gaps) {
    if (gap.end < regionStart) {
      continue
    }
    const startOffset = Math.max(0, gap.start - regionStart)
    const endOffset = gap.end - regionStart
    const length = gap.end - gap.start
    const targetMap = gap.type === 'deletion' ? deletionsByPos : skipsByPos

    // Add to each position the gap covers
    for (let pos = startOffset; pos < endOffset; pos++) {
      let lengths = targetMap.get(pos)
      if (!lengths) {
        lengths = []
        targetMap.set(pos, lengths)
      }
      lengths.push(length)
    }
  }

  for (const [posOffset, lengths] of deletionsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.delskips.deletion = { count: lengths.length, minLen, maxLen, avgLen }
  }

  for (const [posOffset, lengths] of skipsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.delskips.skip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  // Process softclips for interbase tooltip data
  const softclipsByPos = new Map<number, number[]>()
  for (const sc of softclips) {
    if (sc.position < regionStart) {
      continue
    }
    const posOffset = sc.position - regionStart
    let lengths = softclipsByPos.get(posOffset)
    if (!lengths) {
      lengths = []
      softclipsByPos.set(posOffset, lengths)
    }
    lengths.push(sc.length)
  }

  for (const [posOffset, lengths] of softclipsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.interbase.softclip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  // Process hardclips for interbase tooltip data
  const hardclipsByPos = new Map<number, number[]>()
  for (const hc of hardclips) {
    if (hc.position < regionStart) {
      continue
    }
    const posOffset = hc.position - regionStart
    let lengths = hardclipsByPos.get(posOffset)
    if (!lengths) {
      lengths = []
      hardclipsByPos.set(posOffset, lengths)
    }
    lengths.push(hc.length)
  }

  for (const [posOffset, lengths] of hardclipsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(posOffset / coverage.binSize)
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        delskips: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.interbase.hardclip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  const result: WebGLPileupDataResult = {
    regionStart,

    ...readArrays,
    ...gapArrays,
    ...mismatchArrays,
    ...insertionArrays,
    ...softclipArrays,
    ...hardclipArrays,
    ...modificationArrays,

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

    // Convert Map to plain object for RPC serialization
    tooltipData: Object.fromEntries(tooltipData),

    maxY,
    numReads: features.length,
    // Use actual array lengths (may be filtered to exclude positions before regionStart)
    numGaps: gapArrays.gapPositions.length / 2,
    numMismatches: mismatchArrays.mismatchPositions.length,
    numInsertions: insertionArrays.insertionPositions.length,
    numSoftclips: softclipArrays.softclipPositions.length,
    numHardclips: hardclipArrays.hardclipPositions.length,
    numCoverageBins: coverage.depths.length,
    numModifications: modificationArrays.modificationPositions.length,
    numSnpSegments: snpCoverage.count,
    numNoncovSegments: noncovCoverage.segmentCount,
    numIndicators: noncovCoverage.indicatorCount,
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
    result.mismatchPositions.buffer,
    result.mismatchYs.buffer,
    result.mismatchBases.buffer,
    result.mismatchStrands.buffer,
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
    result.modificationPositions.buffer,
    result.modificationYs.buffer,
    result.modificationColors.buffer,
    result.modCovPositions.buffer,
    result.modCovYOffsets.buffer,
    result.modCovHeights.buffer,
    result.modCovColors.buffer,
  ] as ArrayBuffer[]

  return rpcResult(result, transferables)
}
