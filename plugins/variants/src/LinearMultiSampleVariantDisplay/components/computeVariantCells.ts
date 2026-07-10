import Flatbush from '@jbrowse/core/util/flatbush'

import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'
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

export type FeatureGenotypeInfo = VariantFeatureGenotypes

export interface VariantCellData {
  // Absolute genomic positions in uint32 (start, end) interleaved.
  // The renderer + shader split via hpSplitUint against the per-block
  // bpRangeX; no region origin is shipped separately. Hit-testing reads the
  // same array (the flatbush boxes are built from it), so no parallel
  // start/end arrays are shipped.
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  numCells: number
  featureGenotypeMap: Record<string, FeatureGenotypeInfo>
  flatbushData: ArrayBuffer
  cellFeatureIndices: Uint32Array
  featureIdList: string[]
}

function getShapeType(featureType: string) {
  // An inversion is symmetric — it's either inverted or not, there's no
  // meaningful left/right orientation — so it gets a single glyph (VCF never
  // sets a strand on variant records anyway).
  if (featureType === 'inversion') {
    return SHAPE_TRI_LEFT
  }
  // Insertions render as a plain barcode line at their locus, identical to
  // SNPs — the same full-height cell every other genotype cell draws. (They
  // used to get a distinct down-triangle/dot glyph, but that collapsed to a
  // hard-to-read locus-centered dot when zoomed out.)
  return SHAPE_RECT
}

export function computeVariantCells({
  mafs,
  sources,
  renderingMode,
  referenceDrawingMode,
  featureColor,
  genotypesCache,
  report,
}: {
  mafs: MAFFilteredFeature[]
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode: string
  // Optional per-variant color override (e.g. consequence impact). Resolved once
  // per feature; alt-carrying cells take it, ref/no-call cells keep their normal
  // coloring. Undefined = default genotype coloring.
  featureColor?: (feature: Feature) => string | undefined
  genotypesCache: Map<string, Record<string, string>>
  report?: ProgressReporter
}): VariantCellData {
  const alleleColorCache: Record<string, string | undefined> = {}
  const drawRef = referenceDrawingMode === 'draw'

  const numSources = sources.length
  const maxCells = mafs.length * numSources
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const shapeTypes = new Uint8Array(maxCells)
  const isRef = new Uint8Array(maxCells)
  const featureIndices = new Uint32Array(maxCells)
  const featureIdList: string[] = []

  const featureGenotypeMap: Record<string, FeatureGenotypeInfo> = {}
  let cellCount = 0
  let numRefCells = 0

  function addCell(
    genomicStart: number,
    genomicEnd: number,
    rowIndex: number,
    colorAbgr: number,
    shape: number,
    isReference: boolean,
    featureIdx: number,
  ) {
    const ci = cellCount
    // Absolute uint32 genomic positions — the shader hp-splits these against the
    // per-block bpRangeX (no region origin in the uniform). This same array
    // doubles as the hit-test/highlight bound (the flatbush boxes read it).
    positions[ci * 2] = genomicStart
    positions[ci * 2 + 1] = genomicEnd
    rowIndices[ci] = rowIndex
    colors[ci] = colorAbgr
    shapeTypes[ci] = shape
    isRef[ci] = isReference ? 1 : 0
    if (isReference) {
      numRefCells++
    }
    featureIndices[ci] = featureIdx
    cellCount++
  }

  let featureIdx = 0
  for (const { feature, mostFrequentAlt } of mafs) {
    report?.()
    const featureId = feature.id()
    const start = feature.get('start')
    const end = feature.get('end')
    const featureType = feature.get('type')! || ''
    const bpLen = end - start
    const shape = getShapeType(featureType)
    const alt = feature.get('ALT') as string[]
    const ref = feature.get('REF') as string
    const featureName = feature.get('name')!
    const description = feature.get('description') as string
    const renderedGenotypes: Record<string, string> = {}
    // Per-variant override color, resolved once per feature (not per cell);
    // undefined when no override is set, so normal genotype coloring runs.
    const overrideColor = featureColor?.(feature)

    if (renderingMode === 'phased') {
      // PS (phase-set) coloring requires per-sample FORMAT data, which only the
      // heavier `samples` field preserves — the flat `genotypes` map doesn't
      // carry it. PS in FORMAT is uncommon, so the slower samples path runs only
      // when a feature actually declares PS.
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')
      let samp: Record<string, Record<string, string[]>> | undefined
      let stringGenotypes: Record<string, string> | undefined
      if (hasPhaseSet) {
        samp = feature.get('samples') as Record<
          string,
          Record<string, string[]>
        >
      } else {
        stringGenotypes = genotypesCache.get(featureId)
        if (!stringGenotypes) {
          stringGenotypes = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, stringGenotypes)
        }
      }

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
            drawRef,
          )
          if (c) {
            const isRefCell = c === REFERENCE_COLOR
            const cellColor =
              overrideColor !== undefined && !isRefCell ? overrideColor : c
            addCell(
              start,
              end,
              j,
              getCachedABGR(cellColor),
              shape,
              isRefCell,
              featureIdx,
            )
            renderedGenotypes[sampleName] = genotype
          }
        } else {
          addCell(start, end, j, BLACK_ABGR, shape, false, featureIdx)
          renderedGenotypes[sampleName] = genotype
        }
      }
    } else {
      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

      for (let j = 0; j < numSources; j++) {
        const { sampleName } = sources[j]!
        const genotype = samp[sampleName]
        if (genotype) {
          const c = getAlleleColor(
            genotype,
            mostFrequentAlt,
            alleleColorCache,
            drawRef,
            overrideColor,
          )
          if (c) {
            addCell(
              start,
              end,
              j,
              getCachedABGR(c),
              shape,
              c === REFERENCE_COLOR,
              featureIdx,
            )
            renderedGenotypes[sampleName] = genotype
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
      type: featureType,
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
  const outFeatureIndices = new Uint32Array(outCount)
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
    outFeatureIndices[w] = featureIndices[i]!
  }

  // Flatbush requires at least one add() per the constructor-declared count,
  // so the empty case gets a single degenerate entry that hit-testing will
  // never match.
  const flatbush = new Flatbush(Math.max(outCount, 1))
  if (outCount > 0) {
    for (let i = 0; i < outCount; i++) {
      flatbush.add(
        outPositions[i * 2]!,
        outRowIndices[i]!,
        outPositions[i * 2 + 1],
        outRowIndices[i]! + 1,
      )
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    cellPositions: outPositions,
    cellRowIndices: outRowIndices,
    cellColors: outColors,
    cellShapeTypes: outShapeTypes,
    numCells: outCount,
    featureGenotypeMap,
    flatbushData: flatbush.data,
    cellFeatureIndices: outFeatureIndices,
    featureIdList,
  }
}
