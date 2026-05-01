import Flatbush from '@jbrowse/core/util/flatbush'

import {
  SHAPE_RECT,
  SHAPE_TRI_DOWN,
  SHAPE_TRI_LEFT,
  SHAPE_TRI_RIGHT,
} from './variantShape.ts'
import { REFERENCE_COLOR } from '../../shared/constants.ts'
import {
  getAlleleColor,
  getColorAlleleCount,
} from '../../shared/drawAlleleCount.ts'
import { getPhasedColor } from '../../shared/getPhasedColor.ts'
import {
  buildSampleIndexMap,
  genotypeStringFromRaw,
  getPhasedColorFromRaw,
  getRawCallGenotype,
} from '../../shared/rawGenotypes.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

export interface FeatureGenotypeInfo {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
  genotypes: Record<string, string>
}

export interface VariantCellData {
  regionStart: number
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  numCells: number
  featureGenotypeMap: Record<string, FeatureGenotypeInfo>
  flatbushData: ArrayBuffer
  flatbushGenomicStarts: Uint32Array
  flatbushGenomicEnds: Uint32Array
  flatbushFeatureIndices: Uint32Array
  featureIdList: string[]
  sourceNameList: string[]
  inputKey: string
}

function getShapeType(featureType: string, featureStrand?: number) {
  if (featureType === 'inversion') {
    return featureStrand === 1 ? SHAPE_TRI_RIGHT : SHAPE_TRI_LEFT
  }
  if (featureType === 'insertion') {
    return SHAPE_TRI_DOWN
  }
  return SHAPE_RECT
}

function getInsertionRenderEnd(
  start: number,
  end: number,
  alt: string[],
  feature: Feature,
) {
  let maxLen = end - start
  for (const a of alt) {
    maxLen = Math.max(maxLen, a.length)
  }
  const info = feature.get('INFO')
  if (Array.isArray(info?.SVLEN)) {
    for (const sv of info.SVLEN) {
      maxLen = Math.max(maxLen, Math.abs(+sv))
    }
  }
  return start + maxLen
}

const BLACK_ABGR = 0xff000000

export function computeVariantCells({
  mafs,
  sources,
  renderingMode,
  referenceDrawingMode,
  genotypesCache,
  inputKey,
}: {
  mafs: MAFFilteredFeature[]
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode: string
  genotypesCache: Map<string, Record<string, string>>
  inputKey: string
}): VariantCellData {
  const alleleColorCache: Record<string, string | undefined> = {}
  const rawColorCache = new Map<number, string>()
  const drawRef = referenceDrawingMode === 'draw'

  const numSources = sources.length
  const maxCells = mafs.length * numSources
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const shapeTypes = new Uint8Array(maxCells)
  const isRef = new Uint8Array(maxCells)
  const fbGenomicStarts = new Uint32Array(maxCells)
  const fbGenomicEnds = new Uint32Array(maxCells)
  const fbFeatureIndices = new Uint32Array(maxCells)
  const sourceNameList = sources.map(s => s.name)
  const featureIdList: string[] = []

  let regionStart = mafs[0]?.feature.get('start') ?? 0
  for (const { feature } of mafs) {
    const s = feature.get('start')
    if (s < regionStart) {
      regionStart = s
    }
  }

  const featureGenotypeMap: Record<string, FeatureGenotypeInfo> = {}
  let cellCount = 0
  let numRefCells = 0

  function addCell(
    genomicStart: number,
    genomicEnd: number,
    renderEnd: number,
    rowIndex: number,
    colorAbgr: number,
    shape: number,
    isReference: boolean,
    featureIdx: number,
  ) {
    const ci = cellCount
    positions[ci * 2] = genomicStart - regionStart
    positions[ci * 2 + 1] = renderEnd - regionStart
    rowIndices[ci] = rowIndex
    colors[ci] = colorAbgr
    shapeTypes[ci] = shape
    isRef[ci] = isReference ? 1 : 0
    if (isReference) {
      numRefCells++
    }
    fbGenomicStarts[ci] = genomicStart
    fbGenomicEnds[ci] = genomicEnd
    fbFeatureIndices[ci] = featureIdx
    cellCount++
  }

  const firstRaw = mafs[0] ? getRawCallGenotype(mafs[0].feature) : undefined
  const sampleIndexMap = firstRaw
    ? buildSampleIndexMap(mafs[0]!.feature.get('sampleNames') as string[])
    : undefined
  let sampleIndices: Int32Array | undefined
  if (sampleIndexMap) {
    sampleIndices = new Int32Array(numSources).fill(-1)
    for (let j = 0; j < numSources; j++) {
      const si = sampleIndexMap.get(sources[j]!.sampleName)
      if (si !== undefined) {
        sampleIndices[j] = si
      }
    }
  }

  let featureIdx = 0
  for (const { feature, mostFrequentAlt } of mafs) {
    const featureId = feature.id()
    const start = feature.get('start')
    const end = feature.get('end')
    const featureType = feature.get('type')! || ''
    const featureStrand = feature.get('strand')
    const bpLen = end - start
    const shape = getShapeType(featureType, featureStrand)
    const alt = feature.get('ALT') as string[]
    const ref = feature.get('REF') as string
    const featureName = feature.get('name')!
    const description = feature.get('description') as string
    const renderedGenotypes: Record<string, string> = {}
    const renderEnd =
      shape === SHAPE_TRI_DOWN
        ? getInsertionRenderEnd(start, end, alt, feature)
        : end

    const callGt = getRawCallGenotype(feature)
    if (renderingMode === 'phased') {
      if (callGt && sampleIndices) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name, HP } = sources[j]!
          const si = sampleIndices[j]!
          if (si < 0) {
            continue
          }
          const isPhasedSample = callGtPhased
            ? Boolean(callGtPhased[si])
            : false
          const gtStr = genotypeStringFromRaw(callGt, si, ploidy, callGtPhased)
          if (isPhasedSample) {
            const allele = callGt[si * ploidy + HP!]!
            const c = getPhasedColorFromRaw(
              allele,
              mostFreqAltInt,
              undefined,
              drawRef,
            )
            if (c) {
              addCell(
                start,
                end,
                renderEnd,
                j,
                getCachedABGR(c),
                shape,
                c === REFERENCE_COLOR,
                featureIdx,
              )
              renderedGenotypes[name] = gtStr
            }
          } else {
            addCell(
              start,
              end,
              renderEnd,
              j,
              BLACK_ABGR,
              shape,
              false,
              featureIdx,
            )
            renderedGenotypes[name] = gtStr
          }
        }
      } else {
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }

        for (let j = 0; j < numSources; j++) {
          const { name, HP, sampleName } = sources[j]!
          const genotype = samp[sampleName]
          if (genotype) {
            const isPhasedGt = genotype.includes('|')
            if (isPhasedGt) {
              const alleles =
                genotype.length === 3
                  ? [genotype[0]!, genotype[2]!]
                  : genotype.split('|')
              const c = getPhasedColor(
                alleles,
                HP!,
                mostFrequentAlt,
                undefined,
                drawRef,
              )
              if (c) {
                addCell(
                  start,
                  end,
                  renderEnd,
                  j,
                  getCachedABGR(c),
                  shape,
                  c === REFERENCE_COLOR,
                  featureIdx,
                )
                renderedGenotypes[name] = genotype
              }
            } else {
              addCell(
                start,
                end,
                renderEnd,
                j,
                BLACK_ABGR,
                shape,
                false,
                featureIdx,
              )
              renderedGenotypes[name] = genotype
            }
          }
        }
      }
    } else {
      if (callGt && sampleIndices) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name } = sources[j]!
          const si = sampleIndices[j]!
          if (si < 0) {
            continue
          }
          const offset = si * ploidy
          let refCount = 0
          let altCount = 0
          let alt2Count = 0
          let uncalled = 0
          let total = 0
          for (let pi = 0; pi < ploidy; pi++) {
            const a = callGt[offset + pi]!
            if (a === -2) {
              continue
            }
            total++
            if (a === 0) {
              refCount++
            } else if (a === -1) {
              uncalled++
            } else if (a === mostFreqAltInt) {
              altCount++
            } else {
              alt2Count++
            }
          }
          if (total === 0) {
            continue
          }

          const colorKey =
            refCount | (altCount << 8) | (alt2Count << 16) | (uncalled << 24)
          let c = rawColorCache.get(colorKey)
          if (c === undefined) {
            c = getColorAlleleCount(
              refCount,
              altCount,
              alt2Count,
              uncalled,
              total,
              drawRef,
            )
            rawColorCache.set(colorKey, c)
          }
          if (c) {
            addCell(
              start,
              end,
              renderEnd,
              j,
              getCachedABGR(c),
              shape,
              c === REFERENCE_COLOR,
              featureIdx,
            )
            renderedGenotypes[name] = genotypeStringFromRaw(
              callGt,
              si,
              ploidy,
              callGtPhased,
            )
          }
        }
      } else {
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }

        for (let j = 0; j < numSources; j++) {
          const { name, sampleName } = sources[j]!
          const genotype = samp[sampleName]
          if (genotype) {
            const c = getAlleleColor(
              genotype,
              mostFrequentAlt,
              alleleColorCache,
              drawRef,
            )
            if (c) {
              addCell(
                start,
                end,
                renderEnd,
                j,
                getCachedABGR(c),
                shape,
                c === REFERENCE_COLOR,
                featureIdx,
              )
              renderedGenotypes[name] = genotype
            }
          }
        }
      }
    }

    featureGenotypeMap[featureId] = {
      alt,
      ref,
      name: featureName,
      description,
      length: bpLen,
      genotypes: renderedGenotypes,
    }
    featureIdList.push(featureId)
    featureIdx++
  }

  // Stable two-bucket reorder: ref cells first (when drawn), then non-ref.
  // Skip ref cells entirely when drawRef is false.
  const outCount = drawRef ? cellCount : cellCount - numRefCells
  const outPositions = new Uint32Array(outCount * 2)
  const outRowIndices = new Uint32Array(outCount)
  const outColors = new Uint32Array(outCount)
  const outShapeTypes = new Uint8Array(outCount)
  const outFbGenomicStarts = new Uint32Array(outCount)
  const outFbGenomicEnds = new Uint32Array(outCount)
  const outFbFeatureIndices = new Uint32Array(outCount)
  let refPos = 0
  let nonRefPos = drawRef ? numRefCells : 0
  for (let i = 0; i < cellCount; i++) {
    const ref = isRef[i]
    if (ref && !drawRef) {
      continue
    }
    const w = ref ? refPos++ : nonRefPos++
    outPositions[w * 2] = positions[i * 2]!
    outPositions[w * 2 + 1] = positions[i * 2 + 1]!
    outRowIndices[w] = rowIndices[i]!
    outColors[w] = colors[i]!
    outShapeTypes[w] = shapeTypes[i]!
    outFbGenomicStarts[w] = fbGenomicStarts[i]!
    outFbGenomicEnds[w] = fbGenomicEnds[i]!
    outFbFeatureIndices[w] = fbFeatureIndices[i]!
  }

  // Flatbush requires at least one add() per the constructor-declared count,
  // so the empty case gets a single degenerate entry that hit-testing will
  // never match.
  const flatbush = new Flatbush(Math.max(outCount, 1))
  if (outCount > 0) {
    for (let i = 0; i < outCount; i++) {
      flatbush.add(
        outFbGenomicStarts[i]!,
        outRowIndices[i]!,
        outFbGenomicEnds[i],
        outRowIndices[i]! + 1,
      )
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    regionStart,
    cellPositions: outPositions,
    cellRowIndices: outRowIndices,
    cellColors: outColors,
    cellShapeTypes: outShapeTypes,
    numCells: outCount,
    featureGenotypeMap,
    flatbushData: flatbush.data,
    flatbushGenomicStarts: outFbGenomicStarts,
    flatbushGenomicEnds: outFbGenomicEnds,
    flatbushFeatureIndices: outFbFeatureIndices,
    featureIdList,
    sourceNameList,
    inputKey,
  }
}
