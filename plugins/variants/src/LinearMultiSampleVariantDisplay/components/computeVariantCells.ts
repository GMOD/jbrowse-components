import Flatbush from '@jbrowse/core/util/flatbush'

import {
  SHAPE_RECT,
  SHAPE_TRI_DOWN,
  SHAPE_TRI_LEFT,
  SHAPE_TRI_RIGHT,
} from './variantShape.ts'
import { BLACK_ABGR, REFERENCE_COLOR } from '../../shared/constants.ts'
import {
  getAlleleColor,
  getRawAlleleCountColor,
} from '../../shared/drawAlleleCount.ts'
import { getPhasedColor } from '../../shared/getPhasedColor.ts'
import {
  buildSampleIndices,
  genotypeStringFromRaw,
  getPhasedColorFromRaw,
  getRawCallGenotype,
  splitPhasedAlleles,
} from '../../shared/rawGenotypes.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'

import type { MAFFilteredFeature } from '../../shared/minorAlleleFrequencyUtils.ts'
import type {
  ProcessedSource,
  VariantFeatureGenotypes,
} from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

export type FeatureGenotypeInfo = VariantFeatureGenotypes

export interface VariantCellData {
  // Absolute genomic positions in uint32 (start, renderEnd) interleaved.
  // The renderer + shader split via hpSplitUint against the per-block
  // bpRangeX; no region origin is shipped separately.
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
  const info = feature.get('INFO') as Record<string, unknown[]> | undefined
  if (Array.isArray(info?.SVLEN)) {
    for (const sv of info.SVLEN as number[]) {
      maxLen = Math.max(maxLen, Math.abs(sv))
    }
  }
  return start + maxLen
}

export function computeVariantCells({
  mafs,
  sources,
  renderingMode,
  referenceDrawingMode,
  genotypesCache,
  report,
}: {
  mafs: MAFFilteredFeature[]
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode: string
  genotypesCache: Map<string, Record<string, string>>
  report?: ProgressReporter
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
  const featureIdList: string[] = []

  const featureGenotypeMap: Record<string, FeatureGenotypeInfo> = {}
  let cellCount = 0
  let numRefCells = 0

  function addCell(
    genomicStart: number,
    renderEnd: number,
    rowIndex: number,
    colorAbgr: number,
    shape: number,
    isReference: boolean,
    featureIdx: number,
  ) {
    const ci = cellCount
    // Absolute uint32 genomic positions — the shader hp-splits these
    // against the per-block bpRangeX (no region origin in the uniform).
    positions[ci * 2] = genomicStart
    positions[ci * 2 + 1] = renderEnd
    rowIndices[ci] = rowIndex
    colors[ci] = colorAbgr
    shapeTypes[ci] = shape
    isRef[ci] = isReference ? 1 : 0
    if (isReference) {
      numRefCells++
    }
    // Hit-test/highlight bounds must match the *rendered* glyph extent, not the
    // true VCF end: an insertion's down-triangle is drawn across
    // [start, renderEnd] (centered), so bounding by `end` (~start for a point
    // insertion) leaves the whole triangle unhoverable. renderEnd === end for
    // every non-insertion shape.
    fbGenomicStarts[ci] = genomicStart
    fbGenomicEnds[ci] = renderEnd
    fbFeatureIndices[ci] = featureIdx
    cellCount++
  }

  const sampleIndices = buildSampleIndices(mafs[0]?.feature, sources)

  let featureIdx = 0
  for (const { feature, mostFrequentAlt } of mafs) {
    report?.()
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
      // PS (phase-set) coloring requires per-sample FORMAT data, which only
      // the heavier `samples` field preserves — neither the raw callGenotype
      // Int8Array nor the flat `genotypes` map carry it. PS in FORMAT is
      // uncommon, so the slower samples path runs only when a feature
      // actually declares PS. Mirrors the matrix display's PS branch so
      // phased coloring is consistent across both displays.
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')
      if (hasPhaseSet || !callGt || !sampleIndices) {
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
              addCell(
                start,
                renderEnd,
                j,
                getCachedABGR(c),
                shape,
                c === REFERENCE_COLOR,
                featureIdx,
              )
              renderedGenotypes[sampleName] = genotype
            }
          } else {
            addCell(start, renderEnd, j, BLACK_ABGR, shape, false, featureIdx)
            renderedGenotypes[sampleName] = genotype
          }
        }
      } else {
        const callGtPhased = feature.get('callGenotypePhased') as
          | Uint8Array
          | undefined
        const ploidy = feature.get('ploidy') as number
        const mostFreqAltInt = Number.parseInt(mostFrequentAlt, 10)

        for (let j = 0; j < numSources; j++) {
          const { HP, sampleName } = sources[j]!
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
                renderEnd,
                j,
                getCachedABGR(c),
                shape,
                c === REFERENCE_COLOR,
                featureIdx,
              )
              renderedGenotypes[sampleName] = gtStr
            }
          } else {
            addCell(start, renderEnd, j, BLACK_ABGR, shape, false, featureIdx)
            renderedGenotypes[sampleName] = gtStr
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
          const { sampleName } = sources[j]!
          const si = sampleIndices[j]!
          if (si < 0) {
            continue
          }
          const c = getRawAlleleCountColor(
            callGt,
            si * ploidy,
            ploidy,
            mostFreqAltInt,
            drawRef,
            rawColorCache,
          )
          if (c) {
            addCell(
              start,
              renderEnd,
              j,
              getCachedABGR(c),
              shape,
              c === REFERENCE_COLOR,
              featureIdx,
            )
            renderedGenotypes[sampleName] = genotypeStringFromRaw(
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
          const { sampleName } = sources[j]!
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
                renderEnd,
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
  }
}
