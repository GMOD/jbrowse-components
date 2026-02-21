import { REFERENCE_COLOR } from '../../shared/constants.ts'
import { getAlleleColor } from '../../shared/drawAlleleCount.ts'
import { getPhasedColor } from '../../shared/getPhasedColor.ts'
import { colorToRGBA } from '../../shared/variantWebglUtils.ts'

function writeCell(
  dst: {
    featureIndices: Float32Array
    rowIndices: Uint32Array
    colors: Uint8Array
  },
  w: number,
  src: {
    featureIndices: Float32Array
    rowIndices: Uint32Array
    colors: Uint8Array
  },
  i: number,
) {
  dst.featureIndices[w] = src.featureIndices[i]!
  dst.rowIndices[w] = src.rowIndices[i]!
  const so = i * 4
  const do_ = w * 4
  dst.colors[do_] = src.colors[so]!
  dst.colors[do_ + 1] = src.colors[so + 1]!
  dst.colors[do_ + 2] = src.colors[so + 2]!
  dst.colors[do_ + 3] = src.colors[so + 3]!
}

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { Source } from '../../shared/types.ts'

interface FeatureData {
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
  featureId: string
  genotypes: Record<string, string>
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

  const numFeatures = mafs.length
  const numSources = sources.length
  const maxCells = numFeatures * numSources
  const featureIndices = new Float32Array(maxCells)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint8Array(maxCells * 4)
  const isRef = new Uint8Array(maxCells)

  let cellCount = 0

  const featureData: FeatureData[] = []

  if (renderingMode === 'phased') {
    for (let idx = 0; idx < numFeatures; idx++) {
      const { feature, mostFrequentAlt } = mafs[idx]!
      const featureId = feature.id()
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')

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
        featureData.push({
          alt: feature.get('ALT') as string[],
          ref: feature.get('REF') as string,
          name: feature.get('name') as string,
          description: feature.get('description') as string,
          length: feature.get('end') - feature.get('start'),
          featureId,
          genotypes,
        })

        for (let j = 0; j < numSources; j++) {
          const { name, HP, baseName } = sources[j]!
          const sampleName = baseName ?? name
          const s = samp[sampleName]
          if (s) {
            const genotype = s.GT?.[0]
            if (genotype) {
              const isPhased = genotype.includes('|')
              if (isPhased) {
                const PS = s.PS?.[0]
                const alleles =
                  splitCache[genotype] ??
                  (splitCache[genotype] = genotype.split('|'))
                const c = getPhasedColor(alleles, HP!, mostFrequentAlt, PS)
                if (c) {
                  const rgba = getCachedRGBA(c)
                  const ci = cellCount
                  featureIndices[ci] = idx
                  rowIndices[ci] = j
                  colors[ci * 4] = rgba[0]
                  colors[ci * 4 + 1] = rgba[1]
                  colors[ci * 4 + 2] = rgba[2]
                  colors[ci * 4 + 3] = rgba[3]
                  isRef[ci] = c === REFERENCE_COLOR ? 1 : 0
                  cellCount++
                }
              } else {
                const ci = cellCount
                featureIndices[ci] = idx
                rowIndices[ci] = j
                colors[ci * 4] = 0
                colors[ci * 4 + 1] = 0
                colors[ci * 4 + 2] = 0
                colors[ci * 4 + 3] = 255
                isRef[ci] = 0
                cellCount++
              }
            }
          }
        }
      } else {
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }
        featureData.push({
          alt: feature.get('ALT') as string[],
          ref: feature.get('REF') as string,
          name: feature.get('name') as string,
          description: feature.get('description') as string,
          length: feature.get('end') - feature.get('start'),
          featureId,
          genotypes: samp,
        })
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
              const c = getPhasedColor(alleles, HP!, mostFrequentAlt)
              if (c) {
                const rgba = getCachedRGBA(c)
                const ci = cellCount
                featureIndices[ci] = idx
                rowIndices[ci] = j
                colors[ci * 4] = rgba[0]
                colors[ci * 4 + 1] = rgba[1]
                colors[ci * 4 + 2] = rgba[2]
                colors[ci * 4 + 3] = rgba[3]
                isRef[ci] = c === REFERENCE_COLOR ? 1 : 0
                cellCount++
              }
            } else {
              const ci = cellCount
              featureIndices[ci] = idx
              rowIndices[ci] = j
              colors[ci * 4] = 0
              colors[ci * 4 + 1] = 0
              colors[ci * 4 + 2] = 0
              colors[ci * 4 + 3] = 255
              isRef[ci] = 0
              cellCount++
            }
          }
        }
      }
    }
  } else {
    for (let idx = 0; idx < numFeatures; idx++) {
      const { feature, mostFrequentAlt } = mafs[idx]!
      const featureId = feature.id()
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')

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
        featureData.push({
          alt: feature.get('ALT') as string[],
          ref: feature.get('REF') as string,
          name: feature.get('name') as string,
          description: feature.get('description') as string,
          length: feature.get('end') - feature.get('start'),
          featureId,
          genotypes,
        })

        for (let j = 0; j < numSources; j++) {
          const sampleName = sources[j]!.baseName ?? sources[j]!.name
          const s = samp[sampleName]
          if (s) {
            const genotype = s.GT?.[0]
            if (genotype) {
              const c = getAlleleColor(
                genotype,
                mostFrequentAlt,
                alleleColorCache,
                splitCache,
                true,
              )
              if (c) {
                const rgba = getCachedRGBA(c)
                const ci = cellCount
                featureIndices[ci] = idx
                rowIndices[ci] = j
                colors[ci * 4] = rgba[0]
                colors[ci * 4 + 1] = rgba[1]
                colors[ci * 4 + 2] = rgba[2]
                colors[ci * 4 + 3] = rgba[3]
                isRef[ci] = c === REFERENCE_COLOR ? 1 : 0
                cellCount++
              }
            }
          }
        }
      } else {
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }
        featureData.push({
          alt: feature.get('ALT') as string[],
          ref: feature.get('REF') as string,
          name: feature.get('name') as string,
          description: feature.get('description') as string,
          length: feature.get('end') - feature.get('start'),
          featureId,
          genotypes: samp,
        })
        for (let j = 0; j < numSources; j++) {
          const sampleName = sources[j]!.baseName ?? sources[j]!.name
          const genotype = samp[sampleName]
          if (genotype) {
            const c = getAlleleColor(
              genotype,
              mostFrequentAlt,
              alleleColorCache,
              splitCache,
              true,
            )
            if (c) {
              const rgba = getCachedRGBA(c)
              const ci = cellCount
              featureIndices[ci] = idx
              rowIndices[ci] = j
              colors[ci * 4] = rgba[0]
              colors[ci * 4 + 1] = rgba[1]
              colors[ci * 4 + 2] = rgba[2]
              colors[ci * 4 + 3] = rgba[3]
              isRef[ci] = c === REFERENCE_COLOR ? 1 : 0
              cellCount++
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
