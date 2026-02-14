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
import { detectSimplexModifications } from '../ModificationParser/detectSimplexModifications.ts'
import { getMethBins } from '../ModificationParser/getMethBins.ts'
import { getModPositions } from '../ModificationParser/getModPositions.ts'
import { calculateModificationCounts } from '../shared/calculateModificationCounts.ts'
import {
  computeCoverage,
  computeNoncovCoverage,
  computeSNPCoverage,
  computeSashimiJunctions,
} from '../shared/computeCoverage.ts'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import { getModificationName } from '../shared/modificationData.ts'
import {
  baseToAscii,
  getEffectiveStrand,
  pairOrientationToNum,
  parseCssColor,
} from '../shared/webglRpcUtils.ts'
import { getColorForModification, getTagAlt } from '../util.ts'

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
import type { Feature } from '@jbrowse/core/util'

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

function sortFeatures(
  features: FeatureData[],
  mismatches: MismatchData[],
  sortedBy: NonNullable<RenderWebGLPileupDataArgs['sortedBy']>,
) {
  const { type, pos } = sortedBy

  // Partition: features overlapping the sort position come first
  const overlapping: FeatureData[] = []
  const nonOverlapping: FeatureData[] = []
  for (const f of features) {
    if (f.start <= pos && f.end > pos) {
      overlapping.push(f)
    } else {
      nonOverlapping.push(f)
    }
  }

  if (type === 'basePair') {
    // Build map: featureId → mismatch base character code at sort position
    const baseAtPos = new Map<string, number>()
    for (const mm of mismatches) {
      if (mm.position === pos) {
        baseAtPos.set(mm.featureId, mm.base)
      }
    }

    overlapping.sort((a, b) => {
      const aBase = baseAtPos.get(a.id) ?? 0
      const bBase = baseAtPos.get(b.id) ?? 0
      // Reads with mismatches (non-zero base) sort before ref bases (0)
      if (aBase !== 0 && bBase === 0) {
        return -1
      }
      if (aBase === 0 && bBase !== 0) {
        return 1
      }
      return aBase - bBase
    })
  } else if (type === 'position') {
    overlapping.sort((a, b) => a.start - b.start)
  } else if (type === 'strand') {
    overlapping.sort((a, b) => a.strand - b.strand)
  }

  features.length = 0
  for (const f of overlapping) {
    features.push(f)
  }
  for (const f of nonOverlapping) {
    features.push(f)
  }
}

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
): {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colors: Uint8Array
  count: number
} {
  if (modifications.length === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colors: new Uint8Array(0),
      count: 0,
    }
  }

  // Build per-position SNP counts by base and strand from mismatches
  const snpByPosition = new Map<
    number,
    {
      baseCounts: Record<string, number>
      strandBaseCounts: Record<string, { fwd: number; rev: number }>
    }
  >()
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

  // Group modifications by position → aggregate cumulative probability per unique color (r,g,b key)
  // Track probabilityTotal (sum of probabilities) and probabilityCount (number of mods)
  // for computing average probability for alpha, like the old SNPCoverageRenderer
  const byPosition = new Map<
    number,
    Map<
      string,
      {
        r: number
        g: number
        b: number
        probabilityTotal: number
        probabilityCount: number
        base: string
        isSimplex: boolean
      }
    >
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
    // Accumulate the original probability value directly (no encoding/decoding)
    entry.probabilityTotal += mod.prob
    entry.probabilityCount++
  }

  // Build stacked segments using modifiable/detectable formula
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

    // Get refbase from regionSequence (+1 offset for the 1bp padding)
    const refbase = regionSequence
      ? (
          regionSequence[position - regionSequenceStart + 1] ?? 'N'
        ).toUpperCase()
      : 'N'

    // Build per-base counts including ref bases
    const snpEntry = snpByPosition.get(position)
    const snpBaseCounts = snpEntry?.baseCounts ?? {}
    const snpStrandBaseCounts = snpEntry?.strandBaseCounts ?? {}

    // Total mismatched bases at this position
    const totalSnp = Object.values(snpBaseCounts).reduce((a, b) => a + b, 0)
    const refCount = Math.max(0, depthAtPosition - totalSnp)

    // Build full base counts including refbase
    const baseCounts: Record<string, number> = { ...snpBaseCounts }
    baseCounts[refbase] = (baseCounts[refbase] ?? 0) + refCount

    // Build strand-separated base counts
    const strandBaseCounts: Record<string, { fwd: number; rev: number }> = {}
    for (const [base, sc] of Object.entries(snpStrandBaseCounts)) {
      strandBaseCounts[base] = { ...sc }
    }

    // Add ref base strand counts from fwd/rev depths
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

    // Iterate through colorMap in insertion order - since modifications array
    // is pre-sorted by modType, the colorMap entries are already in sorted order
    let yOffset = 0
    for (const entry of colorMap.values()) {
      const { modifiable, detectable } = calculateModificationCounts({
        base: entry.base,
        isSimplex: entry.isSimplex,
        refbase,
        baseCounts,
        strandBaseCounts,
      })

      // Same formula as reference: (modifiable / score0) * (probabilityTotal / detectable)
      // This uses cumulative probability instead of count for proper stacking
      // scaled to normalized space by * (score0 / regionMaxDepth)
      const modFraction =
        (modifiable / depthAtPosition) * (entry.probabilityTotal / detectable)
      const height = modFraction * (depthAtPosition / regionMaxDepth)

      // Compute average probability for alpha transparency
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

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Define integer bounds: floor for start (include first partially visible position),
  // ceil for end (include last partially visible position).
  // All position offsets throughout this function use regionStart as the reference point.
  const regionStart = Math.floor(region.start)

  // Fetch reference sequence for methylation/modification coloring.
  // Covers the full feature extent (not just visible region) so modification
  // bars render correctly for reads extending beyond the view.
  // 1bp padding on each side for CpG dinucleotide detection at boundaries.
  let regionSequence: string | undefined
  let regionSequenceStart = regionStart
  if (
    (colorBy?.type === 'methylation' || colorBy?.type === 'modifications') &&
    sequenceAdapter
  ) {
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
    regionSequenceStart = seqFetchStart
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
    regionSequence = seqFeats[0]?.get('seq')
  }

  // Track detected modification types (MM tags) found in this region
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
  } = await updateStatus('Processing alignments', statusCallback, async () => {
    const deduped = dedupe(featuresArray, (f: Feature) => f.id())

    const featuresData: FeatureData[] = []
    const gapsData: GapData[] = []
    const mismatchesData: MismatchData[] = []
    const insertionsData: InsertionData[] = []
    const softclipsData: SoftclipData[] = []
    const hardclipsData: HardclipData[] = []
    const modificationsData: ModificationEntry[] = []
    // Per-feature tag color values (only populated when colorBy.type === 'tag')
    const tagColorValues: string[] = []
    const isTagColorMode = colorBy?.type === 'tag' && colorBy.tag && colorTagMap
    for (const feature of deduped) {
      const featureId = feature.id()
      const featureStart = feature.get('start')

      const strand = feature.get('strand')
      featuresData.push({
        id: featureId,
        name: feature.get('name') ?? '',
        start: featureStart,
        end: feature.get('end'),
        flags: feature.get('flags') ?? 0,
        mapq: feature.get('score') ?? feature.get('qual') ?? 60,
        insertSize: Math.abs(feature.get('template_length') ?? 400),
        pairOrientation: pairOrientationToNum(feature.get('pair_orientation')),
        strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
      })

      if (isTagColorMode) {
        const tag = colorBy.tag!
        const tags = feature.get('tags')
        const val = tags ? tags[tag] : feature.get(tag)
        tagColorValues.push(val != null ? String(val) : '')
      }

      const featureMismatches = feature.get('mismatches') as
        | Mismatch[]
        | undefined
      if (featureMismatches) {
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
            // Use effectiveStrand for skip features (sashimi arcs) to respect XS/TS/ts tags
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

      // Always scan for modifications to detect what's available (for menu)
      // but only add to rendering data if colorBy is set to modifications
      const mmTag = getTagAlt(feature, 'MM', 'Mm') as string | undefined
      if (mmTag) {
        const cigarString = feature.get('CIGAR') as string | undefined
        if (cigarString) {
          const cigarOps = parseCigar2(cigarString)

          // Parse mod positions to detect simplex modifications
          const fstrand = feature.get('strand') as -1 | 0 | 1
          const seq = feature.get('seq') as string | undefined
          const simplexSet = seq
            ? detectSimplexModifications(getModPositions(mmTag, seq, fstrand))
            : new Set<string>()

          const mods = getMaxProbModAtEachPosition(feature, cigarOps)
          if (mods) {
            const modThreshold = (colorBy?.modifications?.threshold ?? 10) / 100

            // sparse array - use forEach
            // eslint-disable-next-line unicorn/no-array-for-each
            mods.forEach(({ prob, type, base }, refPos) => {
              // Always track detected modification type (for menu)
              detectedModifications.add(type)

              // Track simplex modifications
              if (simplexSet.has(type)) {
                detectedSimplexModifications.add(type)
              }

              // Only add to rendering data if color by modifications and above threshold
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
            const l1 = rSeq[j - regionSequenceStart + 1]
            const l2 = rSeq[j - regionSequenceStart + 2]

            if (l1 === 'c' && l2 === 'g') {
              const methStrand = strand === -1 ? -1 : 1
              // CpG site found - check for methylation at C position
              if (methBins[i]) {
                const p = methProbs[i] || 0
                // Red/blue gradient: red = methylated, blue = unmethylated
                if (p > 0.5) {
                  modificationsData.push({
                    featureId,
                    position: j,
                    base: 'C',
                    modType: 'm',
                    isSimplex: false,
                    strand: methStrand,
                    r: 255,
                    g: 0,
                    b: 0,
                    prob: p,
                  })
                } else {
                  modificationsData.push({
                    featureId,
                    position: j,
                    base: 'C',
                    modType: 'm',
                    isSimplex: false,
                    strand: methStrand,
                    r: 0,
                    g: 0,
                    b: 255,
                    prob: p,
                  })
                }
              } else {
                // CpG site without modification data = unmethylated (blue)
                modificationsData.push({
                  featureId,
                  position: j,
                  base: 'C',
                  modType: 'm',
                  isSimplex: false,
                  strand: strand === -1 ? -1 : 1,
                  r: 0,
                  g: 0,
                  b: 255,
                  prob: 0,
                })
              }

              // Check G position for hydroxymethylation
              if (hydroxyMethBins[i + 1]) {
                const p = hydroxyMethProbs[i + 1] || 0
                if (p > 0.5) {
                  // Pink
                  modificationsData.push({
                    featureId,
                    position: j + 1,
                    base: 'C',
                    modType: 'h',
                    isSimplex: false,
                    strand: methStrand,
                    r: 255,
                    g: 192,
                    b: 203,
                    prob: p,
                  })
                } else {
                  // Purple
                  modificationsData.push({
                    featureId,
                    position: j + 1,
                    base: 'C',
                    modType: 'h',
                    isSimplex: false,
                    strand: methStrand,
                    r: 128,
                    g: 0,
                    b: 128,
                    prob: p,
                  })
                }
              }
            }
          }
        }
      }
    }

    // Build per-read tag colors (RGB Uint8Array)
    let readTagColors = new Uint8Array(0)
    if (isTagColorMode) {
      const tag = colorBy.tag!
      const map = colorTagMap
      // Pre-parse the color map to avoid repeated parsing
      const parsedColors = new Map<string, [number, number, number]>()
      for (const [k, v] of Object.entries(map)) {
        parsedColors.set(k, parseCssColor(v))
      }
      // Strand colors for XS/TS/ts special handling
      const fwdStrandRgb: [number, number, number] = [236, 139, 139] // #EC8B8B
      const revStrandRgb: [number, number, number] = [143, 143, 216] // #8F8FD8
      const nostrandRgb: [number, number, number] = [200, 200, 200] // #c8c8c8

      readTagColors = new Uint8Array(featuresData.length * 3)
      for (const [i, featuresDatum] of featuresData.entries()) {
        const val = tagColorValues[i] ?? ''
        let rgb: [number, number, number]

        if (tag === 'XS' || tag === 'TS') {
          if (val === '-') {
            rgb = revStrandRgb
          } else if (val === '+') {
            rgb = fwdStrandRgb
          } else {
            rgb = nostrandRgb
          }
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
    }

    // Sort modifications by modType for consistent ordering in both
    // rendering (stacking) and tooltips - only needs to be done once here
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
    if (sortedBy) {
      sortFeatures(features, mismatches, sortedBy)
    }
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
    const readNames: string[] = []

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
      readNames.push(f.name)
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
      modificationColors[i * 4 + 3] = Math.round(m.prob * 255)
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
        readNames,
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

  const trackStrands = colorBy?.type === 'modifications'
  const coverage = await updateStatus(
    'Computing coverage',
    statusCallback,
    async () =>
      computeCoverage(features, gaps, regionStart, regionEnd, trackStrands),
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
    mismatches,
    coverage.depths,
    coverage.maxDepth,
    coverage.fwdDepths,
    coverage.revDepths,
    coverage.startOffset,
    regionStart,
    regionSequence,
    regionSequenceStart,
  )

  // Build tooltip data for positions with SNPs or interbase events
  const tooltipData = new Map<
    number,
    {
      position: number
      depth: number
      snps: Record<string, { count: number; fwd: number; rev: number }>
      deletions?: {
        count: number
        minLen: number
        maxLen: number
        avgLen: number
      }
      skips?: { count: number; minLen: number; maxLen: number; avgLen: number }
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
      modifications?: Record<
        string,
        {
          count: number
          fwd: number
          rev: number
          probabilityTotal: number
          color: string
          name: string
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
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: mm.position,
        depth,
        snps: {},
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
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
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

    // Add to each position the gap covers (covers = overlaps with the 1bp position)
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
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.deletions = { count: lengths.length, minLen, maxLen, avgLen }
  }

  for (const [posOffset, lengths] of skipsByPos) {
    let bin = tooltipData.get(posOffset)
    if (!bin) {
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.skips = { count: lengths.length, minLen, maxLen, avgLen }
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
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
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
      const binIdx = Math.floor(
        (posOffset - coverage.startOffset) / coverage.binSize,
      )
      const depth = coverage.depths[binIdx] ?? 0
      bin = {
        position: regionStart + posOffset,
        depth,
        snps: {},
        interbase: {},
      }
      tooltipData.set(posOffset, bin)
    }
    const minLen = Math.min(...lengths)
    const maxLen = Math.max(...lengths)
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length
    bin.interbase.hardclip = { count: lengths.length, minLen, maxLen, avgLen }
  }

  // Process modifications for tooltip data
  if (modifications.length > 0) {
    for (const mod of modifications) {
      if (mod.position < regionStart) {
        continue
      }
      const posOffset = mod.position - regionStart
      let bin = tooltipData.get(posOffset)
      if (!bin) {
        const binIdx = Math.floor(
          (posOffset - coverage.startOffset) / coverage.binSize,
        )
        const depth = coverage.depths[binIdx] ?? 0
        bin = {
          position: mod.position,
          depth,
          snps: {},
          interbase: {},
          modifications: {},
        }
        tooltipData.set(posOffset, bin)
      }
      if (!bin.modifications) {
        bin.modifications = {}
      }
      const modKey = mod.modType
      if (!bin.modifications[modKey]) {
        bin.modifications[modKey] = {
          count: 0,
          fwd: 0,
          rev: 0,
          probabilityTotal: 0,
          color: getColorForModification(mod.modType),
          name: getModificationName(mod.modType),
        }
      }
      bin.modifications[modKey].count++
      // Accumulate probability directly (no encoding/decoding needed)
      bin.modifications[modKey].probabilityTotal += mod.prob
      if (mod.strand === 1) {
        bin.modifications[modKey].fwd++
      } else {
        bin.modifications[modKey].rev++
      }
    }
  }

  const sashimi = computeSashimiJunctions(gaps, regionStart)

  // Calculate insert size statistics for coloring
  // Filter for properly paired reads (flags & 2) excluding secondary (256) and supplementary (2048)
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
    ...mismatchArrays,
    ...insertionArrays,
    ...softclipArrays,
    ...hardclipArrays,
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

    // All detected modification types in this region
    detectedModifications: Array.from(detectedModifications),

    // Simplex modification types detected in this region
    simplexModifications: Array.from(detectedSimplexModifications),
    numIndicators: noncovCoverage.indicatorCount,

    // Insert size statistics (mean ± 3 SD thresholds)
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
    result.readTagColors.buffer,
    result.sashimiX1.buffer,
    result.sashimiX2.buffer,
    result.sashimiScores.buffer,
    result.sashimiColorTypes.buffer,
    result.sashimiCounts.buffer,
  ] as ArrayBuffer[]

  return rpcResult(result, transferables)
}
