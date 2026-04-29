import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { cssColorToRgb, packAbgr } from '@jbrowse/core/util/colorBits'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  applyDepthDependentThreshold,
  computeMismatchFrequencies,
  computePositionFrequencies,
} from './computeCoverage.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from './types.ts'
import {
  baseToAscii,
  getEffectiveStrand,
  pairOrientationToNum,
} from './webglRpcUtils.ts'
import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'

import type { Mismatch } from './types.ts'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  SoftclipData,
} from './webglRpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

type ColorRgbTuple = [number, number, number]

export async function fetchReferenceSequence({
  pluginManager,
  sessionId,
  sequenceAdapter,
  region,
  featuresArray,
  regionStart,
}: {
  pluginManager: PluginManager
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  region: {
    assemblyName: string
    refName: string
    originalRefName?: string
    start: number
    end: number
  }
  featuresArray: Feature[]
  regionStart: number
}) {
  const regionEnd0 = Math.ceil(region.end)
  let seqFetchStart = regionStart
  let seqFetchEnd = regionEnd0
  const maxExtension = regionEnd0 - regionStart
  for (const f of featuresArray) {
    const s = f.get('start')
    const e = f.get('end')
    if (s < seqFetchStart && s >= regionStart - maxExtension) {
      seqFetchStart = s
    }
    if (e > seqFetchEnd && e <= regionEnd0 + maxExtension) {
      seqFetchEnd = e
    }
  }
  const seqAdapter = (
    await getAdapter(pluginManager, sessionId, sequenceAdapter)
  ).dataAdapter as BaseFeatureDataAdapter
  const seqFeats = await firstValueFrom(
    seqAdapter
      .getFeatures({
        ...region,
        refName: region.originalRefName || region.refName,
        start: Math.max(0, seqFetchStart),
        end: seqFetchEnd + 1,
      })
      .pipe(toArray()),
  )
  return {
    regionSequence: seqFeats[0]?.get('seq') as string | undefined,
    regionSequenceStart: Math.max(0, seqFetchStart),
  }
}

export function extractMismatchData(
  featureMismatches: Mismatch[],
  featureId: string,
  featureStart: number,
  strand: number,
  feature: Feature,
  gapsData: GapData[],
  mismatchesData: MismatchData[],
  insertionsData: InsertionData[],
  softclipsData: SoftclipData[],
  hardclipsData: HardclipData[],
  showSoftClipping: boolean,
) {
  for (const mm of featureMismatches) {
    if (mm.type === 'deletion') {
      gapsData.push({
        featureId,
        start: featureStart + mm.start,
        end: featureStart + mm.start + mm.length,
        type: mm.type,
        strand,
        featureStrand: strand,
      })
    } else if (mm.type === 'skip') {
      gapsData.push({
        featureId,
        start: featureStart + mm.start,
        end: featureStart + mm.start + mm.length,
        type: mm.type,
        strand: getEffectiveStrand(feature),
        featureStrand: strand,
      })
    } else if (mm.type === 'mismatch') {
      mismatchesData.push({
        featureId,
        position: featureStart + mm.start,
        base: baseToAscii(mm.base),
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
      const isLeftClip = mm.start === 0
      const clipStart = isLeftClip
        ? featureStart - mm.cliplen
        : featureStart + mm.start
      const seq = showSoftClipping
        ? (feature.get('seq') as string | undefined)
        : undefined
      const sequence = seq
        ? seq.slice(
            isLeftClip ? 0 : seq.length - mm.cliplen,
            isLeftClip ? mm.cliplen : seq.length,
          )
        : undefined
      softclipsData.push({
        featureId,
        position: featureStart + mm.start,
        clipStart,
        length: mm.cliplen,
        sequence,
      })
    } else {
      hardclipsData.push({
        featureId,
        position: featureStart + mm.start,
        length: mm.cliplen,
      })
    }
  }
}

export function buildTagColors(
  featuresData: FeatureData[],
  tagColorValues: string[],
  colorBy: { type: string; tag?: string },
  colorTagMap: Record<string, string>,
) {
  const tag = colorBy.tag!
  const parsedColors = new Map<string, ColorRgbTuple>()
  for (const [k, v] of Object.entries(colorTagMap)) {
    parsedColors.set(k, cssColorToRgb(v))
  }
  const fwdStrandRgb: ColorRgbTuple = [236, 139, 139]
  const revStrandRgb: ColorRgbTuple = [143, 143, 216]
  const nostrandRgb: ColorRgbTuple = [200, 200, 200]

  // Pack one ABGR u32 per read. Shader reads `uint tagColor` and unpacks;
  // 0 means "no tag color set" (falls back to the palette).
  const readTagColors = new Uint32Array(featuresData.length)
  for (let i = 0; i < featuresData.length; i++) {
    const featuresDatum = featuresData[i]!
    const val = tagColorValues[i] ?? ''
    let rgb: ColorRgbTuple

    if (tag === 'XS' || tag === 'TS') {
      rgb =
        val === '-' ? revStrandRgb : val === '+' ? fwdStrandRgb : nostrandRgb
    } else if (tag === 'ts') {
      const featureStrand = featuresDatum.strand
      if (val === '-') {
        rgb = featureStrand === -1 ? fwdStrandRgb : revStrandRgb
      } else if (val === '+') {
        rgb = featureStrand === -1 ? revStrandRgb : fwdStrandRgb
      } else {
        rgb = nostrandRgb
      }
    } else {
      rgb = parsedColors.get(val) ?? nostrandRgb
    }
    readTagColors[i] = packAbgr(rgb[0], rgb[1], rgb[2], 255)
  }
  return readTagColors
}

export function extractFeatureTagValue(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  const val = tags ? tags[tag] : feature.get(tag)
  return val != null ? String(val) : ''
}

export function buildBaseFeatureData(feature: Feature): FeatureData {
  const strand = feature.get('strand')
  const qualArray = feature.get('NUMERIC_QUAL') as
    | Uint8Array
    | number[]
    | undefined
  let avgBaseQuality = 30
  if (qualArray && qualArray.length > 0) {
    let sum = 0
    for (const q of qualArray) {
      sum += q
    }
    avgBaseQuality = Math.round(sum / qualArray.length)
  }
  return {
    id: feature.id(),
    name: feature.get('name') ?? '',
    start: feature.get('start'),
    end: feature.get('end'),
    flags: feature.get('flags') ?? 0,
    mapq: feature.get('score') ?? feature.get('qual') ?? 60,
    avgBaseQuality,
    insertSize: Math.abs(feature.get('template_length') ?? 400),
    pairOrientation: pairOrientationToNum(feature.get('pair_orientation')),
    strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
  }
}

interface InterbaseInput {
  featureId: string
  position: number
  length: number
  sequence?: string
}

export function buildInterbaseArrays(
  insertions: InsertionData[],
  softclips: SoftclipData[],
  hardclips: HardclipData[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
) {
  const filteredInsertions = insertions.filter(
    ins => ins.position >= regionStart,
  )
  const filteredSoftclips = softclips.filter(sc => sc.position >= regionStart)
  const filteredHardclips = hardclips.filter(hc => hc.position >= regionStart)

  const totalInterbases =
    filteredInsertions.length +
    filteredSoftclips.length +
    filteredHardclips.length

  const interbasePositions = new Uint32Array(totalInterbases)
  const interbaseYs = new Uint16Array(totalInterbases)
  const interbaseLengths = new Uint16Array(totalInterbases)
  const interbaseTypes = new Uint8Array(totalInterbases)
  const interbaseReadIndices = new Uint32Array(totalInterbases)
  const interbaseSequences: string[] = []

  let idx = 0
  function addItems(items: InterbaseInput[], type: number) {
    for (const item of items) {
      interbasePositions[idx] = item.position
      interbaseLengths[idx] = Math.min(65535, item.length)
      interbaseTypes[idx] = type
      interbaseReadIndices[idx] = getReadIndex(item.featureId)
      interbaseSequences.push(item.sequence ?? '')
      idx++
    }
  }

  addItems(filteredInsertions, INTERBASE_INSERTION)
  addItems(filteredSoftclips, INTERBASE_SOFTCLIP)
  addItems(filteredHardclips, INTERBASE_HARDCLIP)

  return {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseSequences,
    // Counts per type in the canonical layout (ins, then soft, then hard).
    // Lets consumers slice subranges directly without re-scanning types.
    numInsertions: filteredInsertions.length,
    numSoftclips: filteredSoftclips.length,
    numHardclips: filteredHardclips.length,
  }
}

export function buildMismatchArrays(
  mismatches: MismatchData[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
) {
  const filtered = mismatches.filter(mm => mm.position >= regionStart)
  const mismatchPositions = new Uint32Array(filtered.length)
  const mismatchYs = new Uint16Array(filtered.length)
  const mismatchBases = new Uint8Array(filtered.length)
  const mismatchStrands = new Int8Array(filtered.length)
  const mismatchReadIndices = new Uint32Array(filtered.length)
  for (let i = 0; i < filtered.length; i++) {
    const mm = filtered[i]!
    mismatchPositions[i] = mm.position
    mismatchBases[i] = mm.base
    mismatchStrands[i] = mm.strand
    mismatchReadIndices[i] = getReadIndex(mm.featureId)
  }
  return {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchStrands,
    mismatchReadIndices,
  }
}

export function buildSoftclipBaseArrays(
  softclips: SoftclipData[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
) {
  const count = softclips.reduce(
    (sum, sc) => sum + (sc.sequence?.length ?? 0),
    0,
  )
  const softclipBasePositions = new Uint32Array(count)
  const softclipBaseYs = new Uint16Array(count)
  const softclipBaseBases = new Uint8Array(count)
  const softclipBaseReadIndices = new Uint32Array(count)
  let i = 0
  for (const sc of softclips) {
    if (!sc.sequence) {
      continue
    }
    const ri = getReadIndex(sc.featureId)
    for (let k = 0; k < sc.sequence.length; k++) {
      softclipBasePositions[i] = sc.clipStart + k
      softclipBaseBases[i] = sc.sequence.charCodeAt(k)
      softclipBaseReadIndices[i] = ri
      i++
    }
  }
  return {
    softclipBasePositions,
    softclipBaseYs,
    softclipBaseBases,
    softclipBaseReadIndices,
  }
}

export function buildGapArrays(
  gaps: GapData[],
  regionStart: number,
  getReadIndex: (featureId: string) => number,
) {
  const filtered = gaps.filter(g => g.end > regionStart)
  const gapPositions = new Uint32Array(filtered.length * 2)
  const gapYs = new Uint16Array(filtered.length)
  const gapLengths = new Uint16Array(filtered.length)
  const gapTypes = new Uint8Array(filtered.length)
  const gapReadIndices = new Uint32Array(filtered.length)
  for (let i = 0; i < filtered.length; i++) {
    const g = filtered[i]!
    gapPositions[i * 2] = Math.max(regionStart, g.start)
    gapPositions[i * 2 + 1] = g.end
    gapLengths[i] = Math.min(65535, g.end - g.start)
    gapTypes[i] = g.type === 'deletion' ? 0 : 1
    gapReadIndices[i] = getReadIndex(g.featureId)
  }
  return { gapPositions, gapYs, gapLengths, gapTypes, gapReadIndices }
}

// Splits each read into per-exon segments at CIGAR skip (N) gaps.
// Reads without skips produce one segment. Segment starts are clamped
// to regionStart (features starting before regionStart), but ends are NOT
// clipped to regionEnd — the GPU rasterizer handles viewport clipping.
// Positions are absolute genomic uint32 matching readPositions.
// Edge flags encode whether the read's true start/end falls within
// this region (bit 0 = first, bit 1 = last) — used for chevron drawing.
export function buildSegmentArrays(
  features: FeatureData[],
  gaps: GapData[],
  regionStart: number,
  regionEnd: number,
  getReadIndex: (featureId: string) => number,
) {
  const skipsByFeature = new Map<string, GapData[]>()
  for (const g of gaps) {
    if (g.type === 'skip') {
      let list = skipsByFeature.get(g.featureId)
      if (!list) {
        list = []
        skipsByFeature.set(g.featureId, list)
      }
      list.push(g)
    }
  }

  let maxSegments = 0
  for (const f of features) {
    const skips = skipsByFeature.get(f.id)
    maxSegments += skips ? skips.length + 1 : 1
  }

  const segmentPositions = new Uint32Array(maxSegments * 2)
  const segmentReadIndices = new Uint32Array(maxSegments)
  const segmentEdgeFlags = new Uint8Array(maxSegments)

  let segIdx = 0
  for (const f of features) {
    const readIdx = getReadIndex(f.id)
    const readStart = Math.max(regionStart, f.start)
    const readEnd = f.end
    const skips = skipsByFeature.get(f.id)

    // Chevron only at the true read start/end, not at region-clipped edges
    const edgeFlags =
      (f.start >= regionStart ? 0b01 : 0) | (f.end <= regionEnd ? 0b10 : 0)

    if (!skips || skips.length === 0) {
      segmentPositions[segIdx * 2] = readStart
      segmentPositions[segIdx * 2 + 1] = readEnd
      segmentReadIndices[segIdx] = readIdx
      segmentEdgeFlags[segIdx] = edgeFlags
      segIdx++
    } else {
      skips.sort((a, b) => a.start - b.start)

      const firstSegIdx = segIdx
      let cur = readStart
      for (const skip of skips) {
        const gapStart = Math.min(readEnd, Math.max(readStart, skip.start))
        const gapEnd = Math.min(readEnd, Math.max(readStart, skip.end))

        // Exon segment before this gap
        if (gapStart > cur) {
          segmentPositions[segIdx * 2] = cur
          segmentPositions[segIdx * 2 + 1] = gapStart
          segmentReadIndices[segIdx] = readIdx
          segIdx++
        }
        if (gapEnd > cur) {
          cur = gapEnd
        }
      }

      // Exon segment after last gap
      if (cur < readEnd) {
        segmentPositions[segIdx * 2] = cur
        segmentPositions[segIdx * 2 + 1] = readEnd
        segmentReadIndices[segIdx] = readIdx
        segIdx++
      }

      // Reads entirely intronic in this region produce no segments.
      // Apply edge flags to the outermost segments.
      if (segIdx > firstSegIdx) {
        segmentEdgeFlags[firstSegIdx] =
          segmentEdgeFlags[firstSegIdx]! | (edgeFlags & 0b01)
        segmentEdgeFlags[segIdx - 1] =
          segmentEdgeFlags[segIdx - 1]! | (edgeFlags & 0b10)
      }
    }
  }

  const numSegments = segIdx
  return {
    segmentPositions: segmentPositions.slice(0, numSegments * 2),
    segmentReadIndices: segmentReadIndices.slice(0, numSegments),
    segmentEdgeFlags: segmentEdgeFlags.slice(0, numSegments),
    numSegments,
  }
}

export function computeFrequenciesAndThresholds(
  mismatchArrays: { mismatchPositions: Uint32Array; mismatchBases: Uint8Array },
  interbaseArrays: { interbasePositions: Uint32Array },
  gapArrays: { gapPositions: Uint32Array },
  depths: Float32Array,
  coverageStartPos: number,
) {
  const mismatchFrequencies = computeMismatchFrequencies(
    mismatchArrays.mismatchPositions,
    mismatchArrays.mismatchBases,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    mismatchFrequencies,
    mismatchArrays.mismatchPositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
  )
  const interbaseFrequencies = computePositionFrequencies(
    interbaseArrays.interbasePositions,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    interbaseFrequencies,
    interbaseArrays.interbasePositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
    true,
  )
  const gapStartPositions = new Uint32Array(gapArrays.gapPositions.length / 2)
  for (let i = 0; i < gapStartPositions.length; i++) {
    gapStartPositions[i] = gapArrays.gapPositions[i * 2]!
  }
  const gapFrequencies = computePositionFrequencies(
    gapStartPositions,
    depths,
    coverageStartPos,
  )
  applyDepthDependentThreshold(
    gapFrequencies,
    gapStartPositions,
    depths,
    coverageStartPos,
    featureFrequencyThreshold,
    true,
  )

  return { mismatchFrequencies, interbaseFrequencies, gapFrequencies }
}
