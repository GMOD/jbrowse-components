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
import { createCachedABGR } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

const BLACK_ABGR = 0xff000000

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
  cellColors: Uint32Array
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
  sources: ProcessedSource[]
  renderingMode: string
  genotypesCache: Map<string, Record<string, string>>
}): MatrixCellData {
  const getCachedABGR = createCachedABGR()

  const alleleColorCache: Record<string, string | undefined> = {}
  const rawColorCache = new Map<number, string>()

  const numFeatures = mafs.length
  const numSources = sources.length
  const maxCells = numFeatures * numSources
  const featureIndices = new Float32Array(maxCells)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const isRef = new Uint8Array(maxCells)

  let cellCount = 0

  function addCell(
    featureIdx: number,
    rowIdx: number,
    colorAbgr: number,
    isReference: boolean,
  ) {
    const ci = cellCount
    featureIndices[ci] = featureIdx
    rowIndices[ci] = rowIdx
    colors[ci] = colorAbgr
    isRef[ci] = isReference ? 1 : 0
    cellCount++
  }

  const featureData: FeatureData[] = []

  const firstRaw = mafs[0] ? getRawCallGenotype(mafs[0].feature) : undefined
  const sampleIndexMap = firstRaw
    ? buildSampleIndexMap(mafs[0]!.feature.get('sampleNames') as string[])
    : undefined
  const sampleIndices = sampleIndexMap
    ? sources.map(({ sampleName }) => sampleIndexMap.get(sampleName))
    : undefined

  for (let idx = 0; idx < numFeatures; idx++) {
    const { feature, mostFrequentAlt } = mafs[idx]!
    const featureId = feature.id()
    const hasPhaseSet = feature.get('FORMAT')?.includes('PS')

    if (hasPhaseSet) {
      const samp = feature.get('samples') as Record<
        string,
        Record<string, string[]>
      >
      const genotypes: Record<string, string> = {}
      for (const sampleName in samp) {
        const gt = samp[sampleName]!.GT?.[0]
        if (gt) {
          genotypes[sampleName] = gt
        }
      }
      featureData.push(makeFeatureData(feature, featureId, genotypes))

      for (let j = 0; j < numSources; j++) {
        const { name, HP, sampleName } = sources[j]!
        const s = samp[sampleName]
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
                  addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
                }
              } else {
                addCell(idx, j, BLACK_ABGR, false)
              }
            } else {
              const c = getAlleleColor(
                genotype,
                mostFrequentAlt,
                alleleColorCache,
              )
              if (c) {
                addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
              }
            }
          }
        }
      }
    } else {
      const callGt = getRawCallGenotype(feature)
      if (callGt && sampleIndices) {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)
        const genotypes: Record<string, string> = {}

        for (let j = 0; j < numSources; j++) {
          const { name, HP, sampleName } = sources[j]!
          const si = sampleIndices[j]
          if (si === undefined) {
            continue
          }
          if (renderingMode === 'phased') {
            const isPhased = callGtPhased ? Boolean(callGtPhased[si]) : false
            const gtStr = genotypeStringFromRaw(callGt, si, ploidy, callGtPhased)
            if (isPhased) {
              const allele = callGt[si * ploidy + HP!]!
              const c = getPhasedColorFromRaw(allele, mostFreqAltInt)
              if (c) {
                addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
                genotypes[name] = gtStr
              }
            } else {
              addCell(idx, j, BLACK_ABGR, false)
              genotypes[name] = gtStr
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

            const colorKey = refCount | (altCount << 8) | (alt2Count << 16) | (uncalled << 24)
            let c = rawColorCache.get(colorKey)
            if (c === undefined) {
              c = getColorAlleleCount(
                refCount,
                altCount,
                alt2Count,
                uncalled,
                total,
                true,
              )
              rawColorCache.set(colorKey, c)
            }
            if (c) {
              addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
              genotypes[sampleName] = genotypeStringFromRaw(
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
          const genotype = samp[sampleName]
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
                  addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
                }
              } else {
                addCell(idx, j, BLACK_ABGR, false)
              }
            } else {
              const c = getAlleleColor(
                genotype,
                mostFrequentAlt,
                alleleColorCache,
              )
              if (c) {
                addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
              }
            }
          }
        }
      }
    }
  }

  // Stable two-bucket reorder: ref cells first, then non-ref. Matrix always
  // draws ref (unlike the regular variant display) so both buckets always
  // land in the output.
  let numRefCells = 0
  for (let i = 0; i < cellCount; i++) {
    if (isRef[i]) {
      numRefCells++
    }
  }
  const outFeatureIndices = new Float32Array(cellCount)
  const outRowIndices = new Uint32Array(cellCount)
  const outColors = new Uint32Array(cellCount)
  let refPos = 0
  let nonRefPos = numRefCells
  for (let i = 0; i < cellCount; i++) {
    const w = isRef[i] ? refPos++ : nonRefPos++
    outFeatureIndices[w] = featureIndices[i]!
    outRowIndices[w] = rowIndices[i]!
    outColors[w] = colors[i]!
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
