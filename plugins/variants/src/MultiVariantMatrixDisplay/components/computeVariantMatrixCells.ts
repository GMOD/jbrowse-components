import { BLACK_ABGR, REFERENCE_COLOR } from '../../shared/constants.ts'
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
  splitPhasedAlleles,
} from '../../shared/rawGenotypes.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource, VariantFeatureInfo } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

type FeatureData = VariantFeatureInfo & { featureId: string }

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
  let numRefCells = 0

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
    if (isReference) {
      numRefCells++
    }
    cellCount++
  }

  const featureData: FeatureData[] = []

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

  const isPhasedMode = renderingMode === 'phased'

  for (let idx = 0; idx < numFeatures; idx++) {
    const { feature, mostFrequentAlt } = mafs[idx]!
    const featureId = feature.id()
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )

    const callGt = getRawCallGenotype(feature)
    if (hasPhaseSet || !callGt || !sampleIndices) {
      let samp: Record<string, Record<string, string[]>> | undefined
      let stringGenotypes: Record<string, string> | undefined
      if (hasPhaseSet) {
        samp = feature.get('samples') as Record<
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
      } else {
        stringGenotypes = genotypesCache.get(featureId)
        if (!stringGenotypes) {
          stringGenotypes = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, stringGenotypes)
        }
        featureData.push(makeFeatureData(feature, featureId, stringGenotypes))
      }

      if (isPhasedMode) {
        for (let j = 0; j < numSources; j++) {
          const { HP, sampleName } = sources[j]!
          let genotype: string | undefined
          let PS: string | undefined
          if (samp) {
            const s = samp[sampleName]
            genotype = s?.GT?.[0]
            PS = s?.PS?.[0]
          } else {
            genotype = stringGenotypes![sampleName]
          }
          if (!genotype) {
            continue
          }
          if (genotype.includes('|')) {
            const c = getPhasedColor(
              splitPhasedAlleles(genotype),
              HP!,
              mostFrequentAlt,
              PS,
            )
            if (c) {
              addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
            }
          } else {
            addCell(idx, j, BLACK_ABGR, false)
          }
        }
      } else {
        for (let j = 0; j < numSources; j++) {
          const { sampleName } = sources[j]!
          const genotype = samp
            ? samp[sampleName]?.GT?.[0]
            : stringGenotypes![sampleName]
          if (!genotype) {
            continue
          }
          const c = getAlleleColor(genotype, mostFrequentAlt, alleleColorCache)
          if (c) {
            addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
          }
        }
      }
    } else {
      const callGtPhased = feature.get('callGenotypePhased') as
        | Uint8Array
        | undefined
      const ploidy = feature.get('ploidy') as number
      const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)
      const genotypes: Record<string, string> = {}

      if (isPhasedMode) {
        for (let j = 0; j < numSources; j++) {
          const { sampleName, HP } = sources[j]!
          const si = sampleIndices[j]!
          if (si < 0) {
            continue
          }
          const gtStr = genotypeStringFromRaw(callGt, si, ploidy, callGtPhased)
          const isPhased = callGtPhased ? Boolean(callGtPhased[si]) : false
          if (isPhased) {
            const allele = callGt[si * ploidy + HP!]!
            const c = getPhasedColorFromRaw(allele, mostFreqAltInt)
            if (c) {
              addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
              genotypes[sampleName] = gtStr
            }
          } else {
            addCell(idx, j, BLACK_ABGR, false)
            genotypes[sampleName] = gtStr
          }
        }
      } else {
        for (let j = 0; j < numSources; j++) {
          const { sampleName } = sources[j]!
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
    }
  }

  // Stable two-bucket reorder: ref cells first, then non-ref. Matrix always
  // draws ref (unlike the regular variant display) so both buckets always
  // land in the output.
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
