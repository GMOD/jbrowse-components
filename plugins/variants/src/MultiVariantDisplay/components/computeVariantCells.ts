import Flatbush from '@jbrowse/core/util/flatbush'

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
import { createCachedRGBA } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { Source } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

const SHAPE_RECT = 0
const SHAPE_TRI_RIGHT = 1
const SHAPE_TRI_LEFT = 2
const SHAPE_TRI_DOWN = 3

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
  cellColors: Uint8Array
  cellShapeTypes: Uint8Array
  numCells: number
  featureGenotypeMap: Record<string, FeatureGenotypeInfo>
  flatbushData: ArrayBuffer
  flatbushItems: FlatbushItem[]
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
  const info = feature.get('INFO') as Record<string, string[]> | undefined
  if (info?.SVLEN) {
    for (const sv of info.SVLEN) {
      maxLen = Math.max(maxLen, Math.abs(+sv))
    }
  }
  return start + maxLen
}

export interface FlatbushItem {
  featureId: string
  sourceName: string
  genomicStart: number
  genomicEnd: number
}

interface CellArrays {
  positions: Uint32Array
  rowIndices: Uint32Array
  colors: Uint8Array
  shapeTypes: Uint8Array
  flatbushItems: FlatbushItem[]
}

function writeCellArrays(
  dst: CellArrays,
  w: number,
  src: CellArrays,
  i: number,
) {
  dst.positions[w * 2] = src.positions[i * 2]!
  dst.positions[w * 2 + 1] = src.positions[i * 2 + 1]!
  dst.rowIndices[w] = src.rowIndices[i]!
  const sOff = i * 4
  const dOff = w * 4
  dst.colors[dOff] = src.colors[sOff]!
  dst.colors[dOff + 1] = src.colors[sOff + 1]!
  dst.colors[dOff + 2] = src.colors[sOff + 2]!
  dst.colors[dOff + 3] = src.colors[sOff + 3]!
  dst.shapeTypes[w] = src.shapeTypes[i]!
  dst.flatbushItems[w] = src.flatbushItems[i]!
}

export function computeVariantCells({
  mafs,
  sources,
  renderingMode,
  referenceDrawingMode,
  genotypesCache,
}: {
  mafs: MAFFilteredFeature[]
  sources: Source[]
  renderingMode: string
  referenceDrawingMode: string
  genotypesCache: Map<string, Record<string, string>>
}): VariantCellData {
  const getCachedRGBA = createCachedRGBA()

  const alleleColorCache = {} as Record<string, string | undefined>
  const rawColorCache = {} as Record<string, string>
  const drawRef = referenceDrawingMode === 'draw'

  const numSources = sources.length
  const maxCells = mafs.length * numSources
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint8Array(maxCells * 4)
  const shapeTypes = new Uint8Array(maxCells)
  const isRef = new Uint8Array(maxCells)
  const flatbushItemsSrc: FlatbushItem[] = []

  let regionStart = Number.MAX_SAFE_INTEGER
  for (const { feature } of mafs) {
    const s = feature.get('start')
    if (s < regionStart) {
      regionStart = s
    }
  }
  if (regionStart === Number.MAX_SAFE_INTEGER) {
    regionStart = 0
  }

  const featureGenotypeMap = {} as Record<string, FeatureGenotypeInfo>
  let cellCount = 0

  function addCell(
    genomicStart: number,
    genomicEnd: number,
    renderEnd: number,
    rowIndex: number,
    rgba: [number, number, number, number],
    shape: number,
    isReference: boolean,
    featureId: string,
    sourceName: string,
  ) {
    const ci = cellCount
    positions[ci * 2] = genomicStart - regionStart
    positions[ci * 2 + 1] = renderEnd - regionStart
    rowIndices[ci] = rowIndex
    colors[ci * 4] = rgba[0]
    colors[ci * 4 + 1] = rgba[1]
    colors[ci * 4 + 2] = rgba[2]
    colors[ci * 4 + 3] = rgba[3]
    shapeTypes[ci] = shape
    isRef[ci] = isReference ? 1 : 0
    flatbushItemsSrc[ci] = { featureId, sourceName, genomicStart, genomicEnd }
    cellCount++
  }

  const firstRaw = mafs[0] ? getRawCallGenotype(mafs[0].feature) : undefined
  const sampleIndexMap = firstRaw
    ? buildSampleIndexMap(mafs[0]!.feature.get('sampleNames') as string[])
    : undefined

  for (const { feature, mostFrequentAlt } of mafs) {
    const featureId = feature.id()
    const start = feature.get('start')
    const end = feature.get('end')
    const featureType = (feature.get('type') as string) || ''
    const featureStrand = feature.get('strand') as number | undefined
    const bpLen = end - start
    const shape = getShapeType(featureType, featureStrand)
    const alt = feature.get('ALT') as string[]
    const ref = feature.get('REF') as string
    const featureName = feature.get('name') as string
    const description = feature.get('description') as string
    const renderedGenotypes = {} as Record<string, string>
    const renderEnd =
      shape === SHAPE_TRI_DOWN
        ? getInsertionRenderEnd(start, end, alt, feature)
        : end

    const callGt = getRawCallGenotype(feature)
    if (renderingMode === 'phased') {
      if (callGt && sampleIndexMap) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name, HP, sampleName } = sources[j]!
          const si = sampleIndexMap.get(sampleName ?? name)
          if (si === undefined) {
            continue
          }
          const isPhasedSample = callGtPhased
            ? Boolean(callGtPhased[si])
            : false
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
                getCachedRGBA(c),
                shape,
                c === REFERENCE_COLOR,
                featureId,
                name,
              )
              renderedGenotypes[name] = genotypeStringFromRaw(
                callGt,
                si,
                ploidy,
                callGtPhased,
              )
            }
          } else {
            addCell(
              start,
              end,
              renderEnd,
              j,
              [0, 0, 0, 255],
              shape,
              false,
              featureId,
              name,
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
          const { name, HP, sampleName } = sources[j]!
          const genotype = samp[sampleName ?? name]
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
                  getCachedRGBA(c),
                  shape,
                  c === REFERENCE_COLOR,
                  featureId,
                  name,
                )
                renderedGenotypes[name] = genotype
              }
            } else {
              addCell(
                start,
                end,
                renderEnd,
                j,
                [0, 0, 0, 255],
                shape,
                false,
                featureId,
                name,
              )
              renderedGenotypes[name] = genotype
            }
          }
        }
      }
    } else {
      if (callGt && sampleIndexMap) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name, sampleName } = sources[j]!
          const si = sampleIndexMap.get(sampleName ?? name)
          if (si === undefined) {
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

          const cacheKey = `${refCount}:${altCount}:${alt2Count}:${uncalled}:${total}:${drawRef ? 1 : 0}`
          let c = rawColorCache[cacheKey]
          if (c === undefined) {
            c = getColorAlleleCount(
              refCount,
              altCount,
              alt2Count,
              uncalled,
              total,
              drawRef,
            )
            rawColorCache[cacheKey] = c
          }
          if (c) {
            addCell(
              start,
              end,
              renderEnd,
              j,
              getCachedRGBA(c),
              shape,
              c === REFERENCE_COLOR,
              featureId,
              name,
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
          const genotype = samp[sampleName ?? name]
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
                getCachedRGBA(c),
                shape,
                c === REFERENCE_COLOR,
                featureId,
                name,
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
  }

  const src = {
    positions,
    rowIndices,
    colors,
    shapeTypes,
    flatbushItems: flatbushItemsSrc,
  }
  const outPositions = new Uint32Array(cellCount * 2)
  const outRowIndices = new Uint32Array(cellCount)
  const outColors = new Uint8Array(cellCount * 4)
  const outShapeTypes = new Uint8Array(cellCount)
  const outFlatbushItems: FlatbushItem[] = new Array(cellCount)
  const dst = {
    positions: outPositions,
    rowIndices: outRowIndices,
    colors: outColors,
    shapeTypes: outShapeTypes,
    flatbushItems: outFlatbushItems,
  }
  let w = 0
  if (drawRef) {
    for (let i = 0; i < cellCount; i++) {
      if (isRef[i]) {
        writeCellArrays(dst, w++, src, i)
      }
    }
  }
  for (let i = 0; i < cellCount; i++) {
    if (!isRef[i]) {
      writeCellArrays(dst, w++, src, i)
    }
  }

  const flatbush = new Flatbush(Math.max(w, 1))
  if (w > 0) {
    for (let i = 0; i < w; i++) {
      const item = outFlatbushItems[i]!
      flatbush.add(
        item.genomicStart,
        outRowIndices[i]!,
        item.genomicEnd,
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
    numCells: w,
    featureGenotypeMap,
    flatbushData: flatbush.data,
    flatbushItems: outFlatbushItems,
  }
}
