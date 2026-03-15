import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import {
  applyDepthDependentThreshold,
  computeMismatchFrequencies,
  computePositionFrequencies,
} from './computeCoverage.ts'
import { getMaxProbModAtEachPosition } from './getMaximumModificationAtEachPosition.ts'
import {
  baseToAscii,
  getEffectiveStrand,
  pairOrientationToNum,
  parseCssColor,
} from './webglRpcUtils.ts'
import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'
import { parseCigar2 } from '../MismatchParser/index.ts'
import { detectSimplexModifications } from '../ModificationParser/detectSimplexModifications.ts'
import { getMethBins } from '../ModificationParser/getMethBins.ts'
import { getModPositions } from '../ModificationParser/getModPositions.ts'
import { getColorForModification, getTagAlt } from '../util.ts'

import type { Mismatch } from './types'
import type {
  FeatureData,
  GapData,
  HardclipData,
  InsertionData,
  MismatchData,
  ModificationEntry,
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
  regionWithAssembly,
  region,
  featuresArray,
  regionStart,
}: {
  pluginManager: PluginManager
  sessionId: string
  sequenceAdapter: Record<string, unknown>
  regionWithAssembly: { refName: string; assemblyName: string }
  region: {
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
        ...regionWithAssembly,
        refName: region.originalRefName || region.refName,
        start: Math.max(0, seqFetchStart - 1),
        end: seqFetchEnd + 1,
      })
      .pipe(toArray()),
  )
  return {
    regionSequence: seqFeats[0]?.get('seq') as string | undefined,
    regionSequenceStart: seqFetchStart,
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

export function extractModifications(
  feature: Feature,
  featureId: string,
  featureStart: number,
  strand: number,
  colorBy: { type: string; modifications?: { threshold?: number } } | undefined,
  detectedModifications: Set<string>,
  detectedSimplexModifications: Set<string>,
  modificationsData: ModificationEntry[],
) {
  const mmTag = getTagAlt(feature, 'MM', 'Mm') as string | undefined
  if (!mmTag) {
    return
  }
  const cigarString = feature.get('CIGAR') as string | undefined
  if (!cigarString) {
    return
  }
  const cigarOps = parseCigar2(cigarString)
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const simplexSet = seq
    ? detectSimplexModifications(getModPositions(mmTag, seq, fstrand))
    : new Set<string>()

  const mods = getMaxProbModAtEachPosition(feature, cigarOps)
  if (!mods) {
    return
  }
  const modThreshold = (colorBy?.modifications?.threshold ?? 10) / 100
  // eslint-disable-next-line unicorn/no-array-for-each
  mods.forEach(({ prob, type, base }, refPos) => {
    detectedModifications.add(type)
    if (simplexSet.has(type)) {
      detectedSimplexModifications.add(type)
    }
    if (colorBy?.type === 'modifications' && prob >= modThreshold) {
      const color = getColorForModification(type)
      const [r, g, b] = parseCssColor(color)
      modificationsData.push({
        featureId,
        position: featureStart + refPos,
        base: base.toUpperCase(),
        modType: type,
        isSimplex: simplexSet.has(type),
        strand: strand === -1 ? -1 : 1,
        r,
        g,
        b,
        prob,
      })
    }
  })
}

function pushMethEntry(
  modificationsData: ModificationEntry[],
  featureId: string,
  position: number,
  modType: string,
  strand: number,
  color: [number, number, number],
  prob: number,
) {
  modificationsData.push({
    featureId,
    position,
    base: 'C',
    modType,
    isSimplex: false,
    strand,
    r: color[0],
    g: color[1],
    b: color[2],
    prob,
  })
}

export function extractMethylation(
  feature: Feature,
  featureId: string,
  featureStart: number,
  strand: number,
  regionSequence: string,
  regionSequenceStart: number,
  regionStart: number,
  regionEnd: number,
  modificationsData: ModificationEntry[],
) {
  const cigarString = feature.get('CIGAR') as string | undefined
  if (!cigarString) {
    return
  }
  const cigarOps = parseCigar2(cigarString)
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(feature, cigarOps)

  const featureEnd = feature.get('end')
  const rSeq = regionSequence.toLowerCase()
  const methStrand = strand === -1 ? -1 : 1

  for (
    let i = Math.max(0, regionStart - featureStart);
    i < Math.min(featureEnd - featureStart, regionEnd - featureStart);
    i++
  ) {
    const j = i + featureStart
    const l1 = rSeq[j - regionSequenceStart + 1]
    const l2 = rSeq[j - regionSequenceStart + 2]

    if (l1 !== 'c' || l2 !== 'g') {
      continue
    }

    const methP = methBins[i] ? methProbs[i] || 0 : 0
    pushMethEntry(
      modificationsData,
      featureId,
      j,
      'm',
      methStrand,
      methP > 0.5 ? [255, 0, 0] : [0, 0, 255],
      methP,
    )

    const hydroxyP = hydroxyMethBins[i + 1] ? hydroxyMethProbs[i + 1] || 0 : 0
    pushMethEntry(
      modificationsData,
      featureId,
      j + 1,
      'h',
      methStrand,
      hydroxyP > 0.5 ? [255, 192, 203] : [128, 0, 128],
      hydroxyP,
    )
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
    parsedColors.set(k, parseCssColor(v))
  }
  const fwdStrandRgb: ColorRgbTuple = [236, 139, 139]
  const revStrandRgb: ColorRgbTuple = [143, 143, 216]
  const nostrandRgb: ColorRgbTuple = [200, 200, 200]

  const readTagColors = new Uint8Array(featuresData.length * 3)
  for (const [i, featuresDatum] of featuresData.entries()) {
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
    readTagColors[i * 3] = rgb[0]
    readTagColors[i * 3 + 1] = rgb[1]
    readTagColors[i * 3 + 2] = rgb[2]
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
  return {
    id: feature.id(),
    name: feature.get('name') ?? '',
    start: feature.get('start'),
    end: feature.get('end'),
    flags: feature.get('flags') ?? 0,
    mapq: feature.get('score') ?? feature.get('qual') ?? 60,
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
  getY: (featureId: string) => number,
  getReadIndex?: (featureId: string) => number,
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
  const interbaseReadIndices = getReadIndex
    ? new Uint32Array(totalInterbases)
    : undefined
  const interbaseSequences: string[] = []

  let idx = 0
  function addItems(items: InterbaseInput[], type: number) {
    for (const item of items) {
      const y = getY(item.featureId)
      interbasePositions[idx] = item.position - regionStart
      interbaseYs[idx] = y
      interbaseLengths[idx] = Math.min(65535, item.length)
      interbaseTypes[idx] = type
      if (interbaseReadIndices) {
        interbaseReadIndices[idx] = getReadIndex!(item.featureId)
      }
      interbaseSequences.push(item.sequence ?? '')
      idx++
    }
  }

  addItems(filteredInsertions, 1)
  addItems(filteredSoftclips, 2)
  addItems(filteredHardclips, 3)

  return {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseSequences,
  }
}

export function buildMismatchArrays(
  mismatches: MismatchData[],
  regionStart: number,
  getY: (featureId: string) => number,
  getReadIndex?: (featureId: string) => number,
) {
  const filtered = mismatches.filter(mm => mm.position >= regionStart)
  const mismatchPositions = new Uint32Array(filtered.length)
  const mismatchYs = new Uint16Array(filtered.length)
  const mismatchBases = new Uint8Array(filtered.length)
  const mismatchStrands = new Int8Array(filtered.length)
  const mismatchReadIndices = getReadIndex
    ? new Uint32Array(filtered.length)
    : undefined
  for (const [i, mm] of filtered.entries()) {
    const y = getY(mm.featureId)
    mismatchPositions[i] = mm.position - regionStart
    mismatchYs[i] = y
    mismatchBases[i] = mm.base
    mismatchStrands[i] = mm.strand
    if (mismatchReadIndices) {
      mismatchReadIndices[i] = getReadIndex!(mm.featureId)
    }
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
  getY: (featureId: string) => number,
  getReadIndex?: (featureId: string) => number,
) {
  const count = softclips.reduce(
    (sum, sc) => sum + (sc.sequence?.length ?? 0),
    0,
  )
  const softclipBasePositions = new Uint32Array(count)
  const softclipBaseYs = new Uint16Array(count)
  const softclipBaseBases = new Uint8Array(count)
  const softclipBaseReadIndices = getReadIndex
    ? new Uint32Array(count)
    : undefined
  let i = 0
  for (const sc of softclips) {
    if (!sc.sequence) {
      continue
    }
    const y = getY(sc.featureId)
    const ri = getReadIndex ? getReadIndex(sc.featureId) : 0
    for (let k = 0; k < sc.sequence.length; k++) {
      softclipBasePositions[i] = sc.clipStart + k - regionStart
      softclipBaseYs[i] = y
      softclipBaseBases[i] = sc.sequence.charCodeAt(k)
      if (softclipBaseReadIndices) {
        softclipBaseReadIndices[i] = ri
      }
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
  getY: (featureId: string) => number,
  getReadIndex?: (featureId: string) => number,
) {
  const filtered = gaps.filter(g => g.end > regionStart)
  const gapPositions = new Uint32Array(filtered.length * 2)
  const gapYs = new Uint16Array(filtered.length)
  const gapLengths = new Uint16Array(filtered.length)
  const gapTypes = new Uint8Array(filtered.length)
  const gapReadIndices = getReadIndex
    ? new Uint32Array(filtered.length)
    : undefined
  for (const [i, g] of filtered.entries()) {
    const y = getY(g.featureId)
    gapPositions[i * 2] = Math.max(0, g.start - regionStart)
    gapPositions[i * 2 + 1] = g.end - regionStart
    gapYs[i] = y
    gapLengths[i] = Math.min(65535, g.end - g.start)
    gapTypes[i] = g.type === 'deletion' ? 0 : 1
    if (gapReadIndices) {
      gapReadIndices[i] = getReadIndex!(g.featureId)
    }
  }
  return { gapPositions, gapYs, gapLengths, gapTypes, gapReadIndices }
}

export function buildModificationArrays(
  modifications: ModificationEntry[],
  regionStart: number,
  getY: (featureId: string) => number,
  getReadIndex?: (featureId: string) => number,
) {
  const filtered = modifications.filter(m => m.position >= regionStart)
  const modificationPositions = new Uint32Array(filtered.length)
  const modificationYs = new Uint16Array(filtered.length)
  const modificationColors = new Uint8Array(filtered.length * 4)
  const modificationReadIndices = getReadIndex
    ? new Uint32Array(filtered.length)
    : undefined
  for (const [i, m] of filtered.entries()) {
    const y = getY(m.featureId)
    modificationPositions[i] = m.position - regionStart
    modificationYs[i] = y
    modificationColors[i * 4] = m.r
    modificationColors[i * 4 + 1] = m.g
    modificationColors[i * 4 + 2] = m.b
    modificationColors[i * 4 + 3] = Math.round(m.prob * 255)
    if (modificationReadIndices) {
      modificationReadIndices[i] = getReadIndex!(m.featureId)
    }
  }
  return {
    modificationPositions,
    modificationYs,
    modificationColors,
    modificationReadIndices,
  }
}

// Splits each read into per-exon segments at CIGAR skip (N) gaps.
// Reads without skips produce one segment. Segments are clipped to
// [0, regionEnd-regionStart] so only the visible portion is emitted.
// Edge flags encode whether the read's true start/end falls within
// this region (bit 0 = first, bit 1 = last) — used for chevron drawing.
export function buildSegmentArrays(
  features: FeatureData[],
  gaps: GapData[],
  regionStart: number,
  regionEnd: number,
  getReadIndex: (featureId: string) => number,
) {
  const windowEnd = regionEnd - regionStart

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
    const readStart = Math.max(0, f.start - regionStart)
    const readEnd = Math.min(f.end - regionStart, windowEnd)
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
        const gapStart = Math.min(
          readEnd,
          Math.max(readStart, skip.start - regionStart),
        )
        const gapEnd = Math.min(
          readEnd,
          Math.max(readStart, skip.end - regionStart),
        )

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
  startOffset: number,
) {
  const mismatchFrequencies = computeMismatchFrequencies(
    mismatchArrays.mismatchPositions,
    mismatchArrays.mismatchBases,
    depths,
    startOffset,
  )
  applyDepthDependentThreshold(
    mismatchFrequencies,
    mismatchArrays.mismatchPositions,
    depths,
    startOffset,
    featureFrequencyThreshold,
  )
  const interbaseFrequencies = computePositionFrequencies(
    interbaseArrays.interbasePositions,
    depths,
    startOffset,
  )
  applyDepthDependentThreshold(
    interbaseFrequencies,
    interbaseArrays.interbasePositions,
    depths,
    startOffset,
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
    startOffset,
  )
  applyDepthDependentThreshold(
    gapFrequencies,
    gapStartPositions,
    depths,
    startOffset,
    featureFrequencyThreshold,
    true,
  )

  return { mismatchFrequencies, interbaseFrequencies, gapFrequencies }
}
