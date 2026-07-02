import { BLACK_ABGR, REFERENCE_COLOR } from '../../shared/constants.ts'
import { getAlleleColor } from '../../shared/drawAlleleCount.ts'
import {
  getPhasedColor,
  splitPhasedAlleles,
} from '../../shared/getPhasedColor.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type {
  ProcessedSource,
  VariantFeatureGenotypes,
} from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

type FeatureData = VariantFeatureGenotypes & { featureId: string }

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
    type: feature.get('type') ?? '',
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
  featureColor,
  genotypesCache,
  report,
}: {
  mafs: MAFFilteredFeature[]
  sources: ProcessedSource[]
  renderingMode: string
  // Optional per-variant color override (see computeVariantCells).
  featureColor?: (feature: Feature) => string | undefined
  genotypesCache: Map<string, Record<string, string>>
  report?: ProgressReporter
}): MatrixCellData {
  const alleleColorCache: Record<string, string | undefined> = {}

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

  const isPhasedMode = renderingMode === 'phased'

  for (let idx = 0; idx < numFeatures; idx++) {
    report?.()
    const { feature, mostFrequentAlt } = mafs[idx]!
    const featureId = feature.id()
    const overrideColor = featureColor?.(feature)
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )

    let samp: Record<string, Record<string, string[]>> | undefined
    let stringGenotypes: Record<string, string> | undefined
    if (hasPhaseSet) {
      samp = feature.get('samples') as Record<string, Record<string, string[]>>
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
            const isRefCell = c === REFERENCE_COLOR
            const cellColor =
              overrideColor !== undefined && !isRefCell ? overrideColor : c
            addCell(idx, j, getCachedABGR(cellColor), isRefCell)
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
        const c = getAlleleColor(
          genotype,
          mostFrequentAlt,
          alleleColorCache,
          true,
          overrideColor,
        )
        if (c) {
          addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
        }
      }
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
