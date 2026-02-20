/**
 * WebGL Chain Data RPC Executor
 *
 * Produces WebGLPileupDataResult-compatible output with chain-aware Y layout
 * and connecting line data. Uses PileupLayout on chain bounds (min start →
 * max end) for the linkedRead mode.
 *
 * Reuses the pileup rendering pipeline — individual reads get full CIGAR
 * features (mismatches, gaps, insertions, clips, modifications) while being
 * positioned at their chain's Y row. Coverage is computed identically to pileup.
 */

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

import { parseCigar2 } from '../MismatchParser/index.ts'
import { detectSimplexModifications } from '../ModificationParser/detectSimplexModifications.ts'
import { getMethBins } from '../ModificationParser/getMethBins.ts'
import { getModPositions } from '../ModificationParser/getModPositions.ts'
import { buildTooltipData } from '../shared/buildTooltipData.ts'
import { PairType, getPairedType } from '../shared/color.ts'
import {
  applyDepthDependentThreshold,
  computeCoverage,
  computeMismatchFrequencies,
  computeNoncovCoverage,
  computePositionFrequencies,
  computeSNPCoverage,
  computeSashimiJunctions,
} from '../shared/computeCoverage.ts'
import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'
import { getMaxProbModAtEachPosition } from '../shared/getMaximumModificationAtEachPosition.ts'
import { getInsertSizeStats } from '../shared/insertSizeStats.ts'
import {
  baseToAscii,
  getEffectiveStrand,
  pairOrientationToNum,
  parseCssColor,
} from '../shared/webglRpcUtils.ts'
import { getColorForModification, getTagAlt } from '../util.ts'

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

  // Fetch reference sequence for methylation/modification coloring
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

  const detectedModifications = new Set<string>()
  const detectedSimplexModifications = new Set<string>()

  // Pre-filter: group raw features by read name and apply chain filters
  // BEFORE expensive CIGAR processing. This avoids parsing CIGAR strings
  // for reads that will be discarded.
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
        id: featureId,
        name: feature.get('name') ?? '',
        start: featureStart,
        end: feature.get('end'),
        flags: feature.get('flags') ?? 0,
        mapq: feature.get('score') ?? feature.get('qual') ?? 60,
        insertSize: Math.abs(feature.get('template_length') ?? 400),
        pairOrientation: pairOrientationToNum(feature.get('pair_orientation')),
        strand: strand === -1 ? -1 : strand === 1 ? 1 : 0,
        refName: feature.get('refName'),
        nextRef: feature.get('next_ref'),
        pairOrientationStr: feature.get('pair_orientation'),
        templateLength: feature.get('template_length') ?? 0,
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
            hardclipsData.push({
              featureId,
              position: featureStart + mm.start,
              length: mm.cliplen,
            })
          }
        }
      }

      // Modifications detection and rendering
      const mmTag = getTagAlt(feature, 'MM', 'Mm') as string | undefined
      if (mmTag) {
        const cigarString = feature.get('CIGAR') as string | undefined
        if (cigarString) {
          const cigarOps = parseCigar2(cigarString)
          const fstrand = feature.get('strand') as -1 | 0 | 1
          const seq = feature.get('seq') as string | undefined
          const simplexSet = seq
            ? detectSimplexModifications(getModPositions(mmTag, seq, fstrand))
            : new Set<string>()

          const mods = getMaxProbModAtEachPosition(feature, cigarOps)
          if (mods) {
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
        }
      }

      // Methylation
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
              if (methBins[i]) {
                const p = methProbs[i] || 0
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
              if (hydroxyMethBins[i + 1]) {
                const p = hydroxyMethProbs[i + 1] || 0
                if (p > 0.5) {
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

    // Tag colors
    let readTagColors = new Uint8Array(0)
    if (isTagColorMode) {
      const tag = colorBy.tag!
      const map = colorTagMap
      const parsedColors = new Map<string, [number, number, number]>()
      for (const [k, v] of Object.entries(map)) {
        parsedColors.set(k, parseCssColor(v))
      }
      const fwdStrandRgb: [number, number, number] = [236, 139, 139]
      const revStrandRgb: [number, number, number] = [143, 143, 216]
      const nostrandRgb: [number, number, number] = [200, 200, 200]

      readTagColors = new Uint8Array(featuresData.length * 3)
      for (const [i, featuresDatum] of featuresData.entries()) {
        const val = tagColorValues[i] ?? ''
        let rgb: [number, number, number]
        if (tag === 'XS' || tag === 'TS') {
          rgb =
            val === '-'
              ? revStrandRgb
              : val === '+'
                ? fwdStrandRgb
                : nostrandRgb
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

  // Group already-filtered features into chains by read name
  const featuresByName = groupBy(features, f => f.name)
  const chains = Object.values(featuresByName)

  // Compute insert size stats for color typing
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

  // Compute chain bounds and distances
  const chainBounds: {
    minStart: number
    maxEnd: number
    distance: number
    chainIdx: number
  }[] = []
  let maxDistance = Number.MIN_VALUE

  for (const [chainIdx, chain_] of chains.entries()) {
    const chain = chain_
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
    if (distance > 0) {
      maxDistance = Math.max(maxDistance, distance)
    }
  }

  if (maxDistance === Number.MIN_VALUE) {
    maxDistance = DEFAULT_MAX_DISTANCE
  }

  // Compute Y layout based on mode
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

    // Detect which chains contain supplementary alignments (flag 0x800).
    // If any read in a chain is supplementary, the entire chain is marked
    // so the shader can color all its reads orange (matching canvas behavior).
    const chainHasSupp = new Set<number>()
    for (const [chainIdx, chain_] of chains.entries()) {
      const chain = chain_
      for (const f of chain) {
        if (f.flags & 2048) {
          chainHasSupp.add(chainIdx)
          break
        }
      }
    }

    // Map feature ID → chain index for supplementary lookup
    const featureIdToChainIdx = new Map<string, number>()
    for (const [chainIdx, chain] of chains.entries()) {
      for (const f of chain) {
        featureIdToChainIdx.set(f.id, chainIdx)
      }
    }

    // Build read arrays with chain-aware Y positions
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
      const y = featureIdToY.get(f.id) ?? 0
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

    // Build gap/mismatch/insertion/clip/modification arrays with chain Y
    const regionGaps = gaps.filter(g => g.start >= regionStart)
    const gapPositions = new Uint32Array(regionGaps.length * 2)
    const gapYs = new Uint16Array(regionGaps.length)
    const gapLengths = new Uint16Array(regionGaps.length)
    const gapTypes = new Uint8Array(regionGaps.length)
    for (const [i, g] of regionGaps.entries()) {
      const y = featureIdToY.get(g.featureId) ?? 0
      gapPositions[i * 2] = g.start - regionStart
      gapPositions[i * 2 + 1] = g.end - regionStart
      gapYs[i] = y
      gapLengths[i] = Math.min(65535, g.end - g.start)
      gapTypes[i] = g.type === 'deletion' ? 0 : 1
    }

    const regionMismatches = mismatches.filter(mm => mm.position >= regionStart)
    const mismatchPositions = new Uint32Array(regionMismatches.length)
    const mismatchYs = new Uint16Array(regionMismatches.length)
    const mismatchBases = new Uint8Array(regionMismatches.length)
    const mismatchStrands = new Int8Array(regionMismatches.length)
    for (const [i, mm] of regionMismatches.entries()) {
      const y = featureIdToY.get(mm.featureId) ?? 0
      mismatchPositions[i] = mm.position - regionStart
      mismatchYs[i] = y
      mismatchBases[i] = mm.base
      mismatchStrands[i] = mm.strand
    }

    // Combine insertions, softclips, and hardclips into unified interbase arrays
    const regionInsertions = insertions.filter(
      ins => ins.position >= regionStart,
    )
    const regionSoftclips = softclips.filter(sc => sc.position >= regionStart)
    const regionHardclips = hardclips.filter(hc => hc.position >= regionStart)

    const totalInterbases =
      regionInsertions.length + regionSoftclips.length + regionHardclips.length

    const interbasePositions = new Uint32Array(totalInterbases)
    const interbaseYs = new Uint16Array(totalInterbases)
    const interbaseLengths = new Uint16Array(totalInterbases)
    const interbaseTypes = new Uint8Array(totalInterbases) // 1=insertion, 2=softclip, 3=hardclip
    const interbaseSequences: string[] = []

    let idx = 0
    // Add insertions (type 1)
    for (const ins of regionInsertions) {
      const y = featureIdToY.get(ins.featureId) ?? 0
      interbasePositions[idx] = ins.position - regionStart
      interbaseYs[idx] = y
      interbaseLengths[idx] = Math.min(65535, ins.length)
      interbaseTypes[idx] = 1
      interbaseSequences.push(ins.sequence ?? '')
      idx++
    }
    // Add softclips (type 2)
    for (const sc of regionSoftclips) {
      const y = featureIdToY.get(sc.featureId) ?? 0
      interbasePositions[idx] = sc.position - regionStart
      interbaseYs[idx] = y
      interbaseLengths[idx] = Math.min(65535, sc.length)
      interbaseTypes[idx] = 2
      interbaseSequences.push('')
      idx++
    }
    // Add hardclips (type 3)
    for (const hc of regionHardclips) {
      const y = featureIdToY.get(hc.featureId) ?? 0
      interbasePositions[idx] = hc.position - regionStart
      interbaseYs[idx] = y
      interbaseLengths[idx] = Math.min(65535, hc.length)
      interbaseTypes[idx] = 3
      interbaseSequences.push('')
      idx++
    }

    const regionModifications = modifications.filter(
      m => m.position >= regionStart,
    )
    const modificationPositions = new Uint32Array(regionModifications.length)
    const modificationYs = new Uint16Array(regionModifications.length)
    const modificationColors = new Uint8Array(regionModifications.length * 4)
    for (const [i, m] of regionModifications.entries()) {
      const y = featureIdToY.get(m.featureId) ?? 0
      modificationPositions[i] = m.position - regionStart
      modificationYs[i] = y
      modificationColors[i * 4] = m.r
      modificationColors[i * 4 + 1] = m.g
      modificationColors[i * 4 + 2] = m.b
      modificationColors[i * 4 + 3] = Math.round(m.prob * 255)
    }

    // Build connecting lines: one per chain with 2+ reads
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
      const y = featureIdToY.get(chain[0]!.id) ?? 0
      // Supplementary chains get color type 5 (orange), overriding pair type
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

    // Build Flatbush spatial index for chain hit testing.
    // Each chain gets one bounding box entry: X = [minStart, maxEnd] offsets,
    // Y = chain row. chainFirstReadIndices maps Flatbush item → first read
    // index in the (filtered) features array.
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
        const y = featureIdToY.get(chain[0]!.id) ?? 0
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
      gapArrays: { gapPositions, gapYs, gapLengths, gapTypes },
      mismatchArrays: {
        mismatchPositions,
        mismatchYs,
        mismatchBases,
        mismatchStrands,
      },
      interbaseArrays: {
        interbasePositions,
        interbaseYs,
        interbaseLengths,
        interbaseTypes,
        interbaseSequences,
      },
      modificationArrays: {
        modificationPositions,
        modificationYs,
        modificationColors,
      },
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

  const mismatchFrequencies = computeMismatchFrequencies(
    mismatchArrays.mismatchPositions,
    mismatchArrays.mismatchBases,
    coverage.depths,
    coverage.startOffset,
  )
  applyDepthDependentThreshold(
    mismatchFrequencies,
    mismatchArrays.mismatchPositions,
    coverage.depths,
    coverage.startOffset,
    featureFrequencyThreshold,
  )
  const interbaseFrequencies = computePositionFrequencies(
    interbaseArrays.interbasePositions,
    coverage.depths,
    coverage.startOffset,
  )
  applyDepthDependentThreshold(
    interbaseFrequencies,
    interbaseArrays.interbasePositions,
    coverage.depths,
    coverage.startOffset,
    featureFrequencyThreshold,
  )
  const gapStartPositions = new Uint32Array(gapArrays.gapPositions.length / 2)
  for (let i = 0; i < gapStartPositions.length; i++) {
    gapStartPositions[i] = gapArrays.gapPositions[i * 2]!
  }
  const gapFrequencies = computePositionFrequencies(
    gapStartPositions,
    coverage.depths,
    coverage.startOffset,
  )
  applyDepthDependentThreshold(
    gapFrequencies,
    gapStartPositions,
    coverage.depths,
    coverage.startOffset,
    featureFrequencyThreshold,
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

    // No modification coverage for chain modes (keeps it simpler)
    modCovPositions: new Uint32Array(0),
    modCovYOffsets: new Float32Array(0),
    modCovHeights: new Float32Array(0),
    modCovColors: new Uint8Array(0),
    numModCovSegments: 0,

    ...sashimi,

    tooltipData: Object.fromEntries(tooltipData),
    significantSnpOffsets,

    // Connecting line data
    ...connectingLineArrays,
    maxDistance,

    // Chain spatial index for hit testing
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

    // Insert size statistics (mean ± 3 SD thresholds)
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
