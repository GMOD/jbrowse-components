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

interface CellArrays {
  featureIndices: Float32Array
  rowIndices: Uint32Array
  colors: Uint8Array
}

function writeCell(dst: CellArrays, w: number, src: CellArrays, i: number) {
  dst.featureIndices[w] = src.featureIndices[i]!
  dst.rowIndices[w] = src.rowIndices[i]!
  const sOff = i * 4
  const dOff = w * 4
  dst.colors[dOff] = src.colors[sOff]!
  dst.colors[dOff + 1] = src.colors[sOff + 1]!
  dst.colors[dOff + 2] = src.colors[sOff + 2]!
  dst.colors[dOff + 3] = src.colors[sOff + 3]!
}

interface FeatureData {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
  featureId: string
  genotypes: Record<string, string>
}

function makeFeatureData(
  feature: Feature,
  featureId: string,
  genotypes: Record<string, string>,
): FeatureData {
  return {
    alt: feature.get('ALT') as string[],
    ref: feature.get('REF') as string,
    name: feature.get('name')!,
    description: feature.get('description') as string,
    length: feature.get('end') - feature.get('start'),
    featureId,
    genotypes,
  }
}

export interface MatrixCellData {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint8Array
  numCells: number
  numFeatures: number
  featureData: FeatureData[]
}

export function computeVariantMatrixCells({
  mafs,
  sources,
  renderingMode,
  genotypesCache,
}: {
  mafs: MAFFilteredFeature[]
  sources: Source[]
  renderingMode: string
  genotypesCache: Map<string, Record<string, string>>
}): MatrixCellData {
  const getCachedRGBA = createCachedRGBA()

  const alleleColorCache = {} as Record<string, string | undefined>
  const rawColorCache = {} as Record<string, string>

  const numFeatures = mafs.length
  const numSources = sources.length
  const maxCells = numFeatures * numSources
  const featureIndices = new Float32Array(maxCells)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint8Array(maxCells * 4)
  const isRef = new Uint8Array(maxCells)

  let cellCount = 0

  function addCell(
    featureIdx: number,
    rowIdx: number,
    rgba: [number, number, number, number],
    isReference: boolean,
  ) {
    const ci = cellCount
    featureIndices[ci] = featureIdx
    rowIndices[ci] = rowIdx
    colors[ci * 4] = rgba[0]
    colors[ci * 4 + 1] = rgba[1]
    colors[ci * 4 + 2] = rgba[2]
    colors[ci * 4 + 3] = rgba[3]
    isRef[ci] = isReference ? 1 : 0
    cellCount++
  }

  const BLACK_OPAQUE: [number, number, number, number] = [0, 0, 0, 255]

  const featureData: FeatureData[] = []

  const firstRaw = mafs[0] ? getRawCallGenotype(mafs[0].feature) : undefined
  const sampleIndexMap = firstRaw
    ? buildSampleIndexMap(mafs[0]!.feature.get('sampleNames') as string[])
    : undefined

  for (let idx = 0; idx < numFeatures; idx++) {
    const { feature, mostFrequentAlt } = mafs[idx]!
    const featureId = feature.id()
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )

    if (hasPhaseSet) {
      const samp = feature.get('samples') as Record<
        string,
        Record<string, string[]>
      >
      const genotypes = {} as Record<string, string>
      for (const sampleName in samp) {
        const gt = samp[sampleName]!.GT?.[0]
        if (gt) {
          genotypes[sampleName] = gt
        }
      }
      featureData.push(makeFeatureData(feature, featureId, genotypes))

      for (let j = 0; j < numSources; j++) {
        const { name, HP, sampleName } = sources[j]!
        const s = samp[sampleName ?? name]
        if (s) {
          const genotype = s.GT?.[0]
          if (genotype) {
            if (renderingMode === 'phased') {
              const isPhased = genotype.includes('|')
              if (isPhased) {
                const PS = s.PS?.[0]
                const alleles =
                  genotype.length === 3
                    ? [genotype[0]!, genotype[2]!]
                    : genotype.split('|')
                const c = getPhasedColor(alleles, HP!, mostFrequentAlt, PS)
                if (c) {
                  addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
                }
              } else {
                addCell(idx, j, BLACK_OPAQUE, false)
              }
            } else {
              const c = getAlleleColor(
                genotype,
                mostFrequentAlt,
                alleleColorCache,
                true,
              )
              if (c) {
                addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
              }
            }
          }
        }
      }
    } else {
      const callGt = getRawCallGenotype(feature)
      if (callGt && sampleIndexMap) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)
        const genotypes = {} as Record<string, string>

        for (let j = 0; j < numSources; j++) {
          const { name, HP, sampleName } = sources[j]!
          const si = sampleIndexMap.get(sampleName ?? name)
          if (si === undefined) {
            continue
          }
          if (renderingMode === 'phased') {
            const isPhased = callGtPhased ? Boolean(callGtPhased[si]) : false
            if (isPhased) {
              const allele = callGt[si * ploidy + HP!]!
              const c = getPhasedColorFromRaw(allele, mostFreqAltInt)
              if (c) {
                addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
                genotypes[name] = genotypeStringFromRaw(
                  callGt,
                  si,
                  ploidy,
                  callGtPhased,
                )
              }
            } else {
              addCell(idx, j, BLACK_OPAQUE, false)
              genotypes[name] = genotypeStringFromRaw(
                callGt,
                si,
                ploidy,
                callGtPhased,
              )
            }
          } else {
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

            const cacheKey = `${refCount}:${altCount}:${alt2Count}:${uncalled}:${total}`
            let c = rawColorCache[cacheKey]
            if (c === undefined) {
              c = getColorAlleleCount(
                refCount,
                altCount,
                alt2Count,
                uncalled,
                total,
                true,
              )
              rawColorCache[cacheKey] = c
            }
            if (c) {
              addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
              genotypes[sampleName ?? name] = genotypeStringFromRaw(
                callGt,
                si,
                ploidy,
                callGtPhased,
              )
            }
          }
        }
        featureData.push(makeFeatureData(feature, featureId, genotypes))
      } else {
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }
        featureData.push(makeFeatureData(feature, featureId, samp))
        for (let j = 0; j < numSources; j++) {
          const { name, HP, sampleName } = sources[j]!
          const genotype = samp[sampleName ?? name]
          if (genotype) {
            if (renderingMode === 'phased') {
              const isPhased = genotype.includes('|')
              if (isPhased) {
                const alleles =
                  genotype.length === 3
                    ? [genotype[0]!, genotype[2]!]
                    : genotype.split('|')
                const c = getPhasedColor(alleles, HP!, mostFrequentAlt)
                if (c) {
                  addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
                }
              } else {
                addCell(idx, j, BLACK_OPAQUE, false)
              }
            } else {
              const c = getAlleleColor(
                genotype,
                mostFrequentAlt,
                alleleColorCache,
                true,
              )
              if (c) {
                addCell(idx, j, getCachedRGBA(c), c === REFERENCE_COLOR)
              }
            }
          }
        }
      }
    }
  }

  const src = { featureIndices, rowIndices, colors }
  const outFeatureIndices = new Float32Array(cellCount)
  const outRowIndices = new Uint32Array(cellCount)
  const outColors = new Uint8Array(cellCount * 4)
  const dst = {
    featureIndices: outFeatureIndices,
    rowIndices: outRowIndices,
    colors: outColors,
  }
  let w = 0
  for (let i = 0; i < cellCount; i++) {
    if (isRef[i]) {
      writeCell(dst, w++, src, i)
    }
  }
  for (let i = 0; i < cellCount; i++) {
    if (!isRef[i]) {
      writeCell(dst, w++, src, i)
    }
  }

  return {
    cellFeatureIndices: outFeatureIndices,
    cellRowIndices: outRowIndices,
    cellColors: outColors,
    numCells: cellCount,
    numFeatures,
    featureData,
  }
}
