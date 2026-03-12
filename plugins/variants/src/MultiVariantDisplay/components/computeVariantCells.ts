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
import { colorToRGBA } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { Source } from '../../shared/types.ts'

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

export interface FlatbushItem {
  featureId: string
  sourceName: string
  genomicStart: number
  genomicEnd: number
}

interface TempCell {
  genomicStart: number
  genomicEnd: number
  rowIndex: number
  color: [number, number, number, number]
  shapeType: number
  isReference: boolean
  featureId: string
  sourceName: string
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
  const colorCache = new Map<string, [number, number, number, number]>()
  function getCachedRGBA(color: string) {
    let rgba = colorCache.get(color)
    if (!rgba) {
      rgba = colorToRGBA(color)
      colorCache.set(color, rgba)
    }
    return rgba
  }

  const splitCache = {} as Record<string, string[]>
  const alleleColorCache = {} as Record<string, string | undefined>
  const drawRef = referenceDrawingMode === 'draw'

  const numSources = sources.length
  const maxCells = mafs.length * numSources
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint8Array(maxCells * 4)
  const shapeTypes = new Uint8Array(maxCells)

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
  const allCells: TempCell[] = []

  const firstRaw = mafs[0] ? getRawCallGenotype(mafs[0].feature) : undefined
  const sampleIndexMap = firstRaw
    ? buildSampleIndexMap(mafs[0]!.feature.get('sampleNames') as string[])
    : undefined

  if (renderingMode === 'phased') {
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

      const callGt = getRawCallGenotype(feature)
      if (callGt && sampleIndexMap) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name, HP, baseName } = sources[j]!
          const sampleName = baseName ?? name
          const si = sampleIndexMap.get(sampleName)
          if (si === undefined) {
            continue
          }
          const isPhased = callGtPhased ? Boolean(callGtPhased[si]) : false
          if (isPhased) {
            const allele = callGt[si * ploidy + HP!]!
            const c = getPhasedColorFromRaw(
              allele,
              mostFreqAltInt,
              undefined,
              drawRef,
            )
            if (c) {
              const rgba = getCachedRGBA(c)
              allCells.push({
                genomicStart: start,
                genomicEnd: end,
                rowIndex: j,
                color: [rgba[0], rgba[1], rgba[2], rgba[3]],
                shapeType: shape,
                isReference: c === REFERENCE_COLOR,
                featureId,
                sourceName: name,
              })
              renderedGenotypes[name] = genotypeStringFromRaw(
                callGt,
                si,
                ploidy,
                callGtPhased,
              )
            }
          } else {
            allCells.push({
              genomicStart: start,
              genomicEnd: end,
              rowIndex: j,
              color: [0, 0, 0, 255],
              shapeType: shape,
              isReference: false,
              featureId,
              sourceName: name,
            })
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
          const { name, HP, baseName } = sources[j]!
          const sampleName = baseName ?? name
          const genotype = samp[sampleName]
          if (genotype) {
            const isPhased = genotype.includes('|')
            if (isPhased) {
              const alleles =
                splitCache[genotype] ??
                (splitCache[genotype] = genotype.split('|'))
              const c = getPhasedColor(
                alleles,
                HP!,
                mostFrequentAlt,
                undefined,
                drawRef,
              )
              if (c) {
                const rgba = getCachedRGBA(c)
                allCells.push({
                  genomicStart: start,
                  genomicEnd: end,
                  rowIndex: j,
                  color: [rgba[0], rgba[1], rgba[2], rgba[3]],
                  shapeType: shape,

                  isReference: c === REFERENCE_COLOR,
                  featureId,
                  sourceName: name,
                })
                renderedGenotypes[name] = genotype
              }
            } else {
              allCells.push({
                genomicStart: start,
                genomicEnd: end,
                rowIndex: j,
                color: [0, 0, 0, 255],
                shapeType: shape,

                isReference: false,
                featureId,
                sourceName: name,
              })
              renderedGenotypes[name] = genotype
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
  } else {
    const rawColorCache = {} as Record<string, string>

    for (const { mostFrequentAlt, feature } of mafs) {
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

      const callGt = getRawCallGenotype(feature)
      if (callGt && sampleIndexMap) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { name } = sources[j]!
          const si = sampleIndexMap.get(name)
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
            const rgba = getCachedRGBA(c)
            allCells.push({
              genomicStart: start,
              genomicEnd: end,
              rowIndex: j,
              color: [rgba[0], rgba[1], rgba[2], rgba[3]],
              shapeType: shape,
              isReference: c === REFERENCE_COLOR,
              featureId,
              sourceName: name,
            })
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
          const { name } = sources[j]!
          const genotype = samp[name]
          if (genotype) {
            const c = getAlleleColor(
              genotype,
              mostFrequentAlt,
              alleleColorCache,
              splitCache,
              drawRef,
            )
            if (c) {
              const rgba = getCachedRGBA(c)
              allCells.push({
                genomicStart: start,
                genomicEnd: end,
                rowIndex: j,
                color: [rgba[0], rgba[1], rgba[2], rgba[3]],
                shapeType: shape,
                isReference: c === REFERENCE_COLOR,
                featureId,
                sourceName: name,
              })
              renderedGenotypes[name] = genotype
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
  }

  let cellCount = 0
  const flatbushItems: FlatbushItem[] = []
  function writeCell(cell: TempCell) {
    positions[cellCount * 2] = cell.genomicStart - regionStart
    positions[cellCount * 2 + 1] = cell.genomicEnd - regionStart
    rowIndices[cellCount] = cell.rowIndex
    colors[cellCount * 4] = cell.color[0]
    colors[cellCount * 4 + 1] = cell.color[1]
    colors[cellCount * 4 + 2] = cell.color[2]
    colors[cellCount * 4 + 3] = cell.color[3]
    shapeTypes[cellCount] = cell.shapeType
    flatbushItems.push({
      featureId: cell.featureId,
      sourceName: cell.sourceName,
      genomicStart: cell.genomicStart,
      genomicEnd: cell.genomicEnd,
    })
    cellCount++
  }
  if (drawRef) {
    for (const cell of allCells) {
      if (cell.isReference) {
        writeCell(cell)
      }
    }
  }
  for (const cell of allCells) {
    if (!cell.isReference) {
      writeCell(cell)
    }
  }

  const flatbush = new Flatbush(Math.max(cellCount, 1))
  if (cellCount > 0) {
    for (let i = 0; i < cellCount; i++) {
      const item = flatbushItems[i]!
      flatbush.add(
        item.genomicStart,
        rowIndices[i]!,
        item.genomicEnd,
        rowIndices[i]! + 1,
      )
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    regionStart,
    cellPositions: positions.subarray(0, cellCount * 2),
    cellRowIndices: rowIndices.subarray(0, cellCount),
    cellColors: colors.subarray(0, cellCount * 4),
    cellShapeTypes: shapeTypes.subarray(0, cellCount),
    numCells: cellCount,
    featureGenotypeMap,
    flatbushData: flatbush.data,
    flatbushItems,
  }
}
