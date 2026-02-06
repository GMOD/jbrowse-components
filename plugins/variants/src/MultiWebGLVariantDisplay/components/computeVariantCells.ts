import { set1 } from '@jbrowse/core/ui/colors'

import { REFERENCE_COLOR, UNPHASED_COLOR } from '../../shared/constants.ts'
import { getAlleleColor } from '../../shared/drawAlleleCount.ts'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../../shared/minorAlleleFrequencyUtils.ts'
import { colorToRGBA } from '../../shared/variantWebglUtils.ts'

import type { Source } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

// shape type constants
const SHAPE_RECT = 0
const SHAPE_TRI_RIGHT = 1
const SHAPE_TRI_LEFT = 2
const SHAPE_TRI_DOWN = 3

interface FeatureInfo {
  featureId: string
  start: number
  end: number
  alt: string[]
  ref: string
  name: string
  description: string
  length: number
}

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
  featureList: FeatureInfo[]
  featureGenotypeMap: Record<string, FeatureGenotypeInfo>
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

const colorCache = new Map<string, [number, number, number, number]>()

function getCachedRGBA(color: string) {
  let rgba = colorCache.get(color)
  if (!rgba) {
    rgba = colorToRGBA(color)
    colorCache.set(color, rgba)
  }
  return rgba
}

function getPhasedColor(
  alleles: string[],
  HP: number,
  PS?: string,
  drawReference = true,
) {
  const allele = +alleles[HP]!
  if (allele) {
    const c = PS !== undefined ? `hsl(${+PS % 255}, 50%, 50%)` : set1[allele - 1]
    return c || UNPHASED_COLOR
  }
  return drawReference ? REFERENCE_COLOR : undefined
}

export function computeVariantCells({
  features,
  sources,
  renderingMode,
  minorAlleleFrequencyFilter,
  lengthCutoffFilter,
  referenceDrawingMode,
}: {
  features: Feature[]
  sources: Source[]
  renderingMode: string
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  referenceDrawingMode: string
}): VariantCellData {
  const genotypesCache = new Map<string, Record<string, string>>()
  const splitCache = {} as Record<string, string[]>
  const alleleColorCache = {} as Record<string, string | undefined>
  const drawRef = referenceDrawingMode === 'draw'

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    features,
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    genotypesCache,
    splitCache,
  })

  // estimate max cells (features * sources)
  const maxCells = mafs.length * sources.length
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint8Array(maxCells * 4)
  const shapeTypes = new Uint8Array(maxCells)

  let cellCount = 0

  // find region start from features
  let regionStart = Number.MAX_SAFE_INTEGER
  for (const { feature } of mafs) {
    const s = feature.get('start') as number
    if (s < regionStart) {
      regionStart = s
    }
  }
  if (regionStart === Number.MAX_SAFE_INTEGER) {
    regionStart = 0
  }

  const featureList: FeatureInfo[] = []
  const featureGenotypeMap = {} as Record<string, FeatureGenotypeInfo>

  if (renderingMode === 'phased') {
    for (const { feature } of mafs) {
      const featureId = feature.id()
      const start = feature.get('start') as number
      const end = feature.get('end') as number
      const featureType = (feature.get('type') as string) || ''
      const featureStrand = feature.get('strand') as number | undefined
      const bpLen = end - start
      const alpha = bpLen > 5 ? 0.75 : 1
      const shape = getShapeType(featureType, featureStrand)

      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

      const alt = feature.get('ALT') as string[]
      const ref = feature.get('REF') as string
      const featureName = feature.get('name') as string
      const description = feature.get('description') as string

      featureList.push({
        featureId,
        start,
        end,
        alt,
        ref,
        name: featureName,
        description,
        length: bpLen,
      })
      featureGenotypeMap[featureId] = {
        alt,
        ref,
        name: featureName,
        description,
        length: bpLen,
        genotypes: samp,
      }

      for (let j = 0; j < sources.length; j++) {
        const source = sources[j]!
        const { name, HP, baseName } = source
        const sampleName = baseName ?? name
        const genotype = samp[sampleName]
        if (genotype) {
          const isPhased = genotype.includes('|')
          if (isPhased) {
            const alleles =
              splitCache[genotype] ??
              (splitCache[genotype] = genotype.split('|'))
            const c = getPhasedColor(alleles, HP!, undefined, drawRef)
            if (c) {
              let rgba = getCachedRGBA(c)
              if (alpha !== 1) {
                rgba = [rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * alpha)]
              }
              const idx = cellCount
              positions[idx * 2] = start - regionStart
              positions[idx * 2 + 1] = end - regionStart
              rowIndices[idx] = j
              colors[idx * 4] = rgba[0]
              colors[idx * 4 + 1] = rgba[1]
              colors[idx * 4 + 2] = rgba[2]
              colors[idx * 4 + 3] = rgba[3]
              shapeTypes[idx] = shape
              cellCount++
            }
          } else {
            // unphased - draw black
            const idx = cellCount
            positions[idx * 2] = start - regionStart
            positions[idx * 2 + 1] = end - regionStart
            rowIndices[idx] = j
            colors[idx * 4] = 0
            colors[idx * 4 + 1] = 0
            colors[idx * 4 + 2] = 0
            colors[idx * 4 + 3] = 255
            shapeTypes[idx] = shape
            cellCount++
          }
        }
      }
    }
  } else {
    // alleleCount mode
    for (const { mostFrequentAlt, feature } of mafs) {
      const featureId = feature.id()
      const start = feature.get('start') as number
      const end = feature.get('end') as number
      const featureType = (feature.get('type') as string) || ''
      const featureStrand = feature.get('strand') as number | undefined
      const bpLen = end - start
      const alpha = bpLen > 5 ? 0.75 : 1
      const shape = getShapeType(featureType, featureStrand)

      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

      const alt = feature.get('ALT') as string[]
      const ref = feature.get('REF') as string
      const featureName = feature.get('name') as string
      const description = feature.get('description') as string

      featureList.push({
        featureId,
        start,
        end,
        alt,
        ref,
        name: featureName,
        description,
        length: bpLen,
      })
      featureGenotypeMap[featureId] = {
        alt,
        ref,
        name: featureName,
        description,
        length: bpLen,
        genotypes: samp,
      }

      for (let j = 0; j < sources.length; j++) {
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
            let rgba = getCachedRGBA(c)
            if (alpha !== 1) {
              rgba = [rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * alpha)]
            }
            const idx = cellCount
            positions[idx * 2] = start - regionStart
            positions[idx * 2 + 1] = end - regionStart
            rowIndices[idx] = j
            colors[idx * 4] = rgba[0]
            colors[idx * 4 + 1] = rgba[1]
            colors[idx * 4 + 2] = rgba[2]
            colors[idx * 4 + 3] = rgba[3]
            shapeTypes[idx] = shape
            cellCount++
          }
        }
      }
    }
  }

  return {
    regionStart,
    cellPositions: positions.subarray(0, cellCount * 2),
    cellRowIndices: rowIndices.subarray(0, cellCount),
    cellColors: colors.subarray(0, cellCount * 4),
    cellShapeTypes: shapeTypes.subarray(0, cellCount),
    numCells: cellCount,
    featureList,
    featureGenotypeMap,
  }
}
