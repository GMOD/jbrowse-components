import Flatbush from '@jbrowse/core/util/flatbush'

import { getInsertedBp } from '../../shared/alleleLength.ts'
import {
  BLACK_ABGR,
  NO_CALL_COLOR,
  REFERENCE_COLOR,
} from '../../shared/constants.ts'
import { getAlleleColor } from '../../shared/drawAlleleCount.ts'
import {
  getPhasedColor,
  isNoCall,
  splitPhasedAlleles,
} from '../../shared/getPhasedColor.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'

import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type {
  ProcessedSource,
  VariantFeatureGenotypes,
} from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

export type FeatureGenotypeInfo = VariantFeatureGenotypes

export interface VariantCellData {
  // Absolute genomic positions in uint32 (start, end) interleaved.
  // The renderer + shader split via hpSplitUint against the per-block
  // bpRangeX; no region origin is shipped separately.
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  // 1 where the cell's genotype carries a non-reference allele. Reference and
  // no-call cells are 0: the insertion-glyph pass widens only the haplotypes
  // that actually have the extra sequence, and widening a reference cell would
  // claim every sample carries it.
  cellCarriesAlt: Uint8Array
  numCells: number
  featureGenotypeMap: Record<string, FeatureGenotypeInfo>
  cellFeatureIndices: Uint32Array
  featureIdList: string[]
  // Absolute genomic (start, end) interleaved per *feature*, aligned to
  // `featureIdList`. Every cell of one variant shares this span, so the
  // hit-test and the hover highlight read it here rather than through a cell.
  featurePositions: Uint32Array
  // Spatial index over `featurePositions` — numFeatures intervals, not
  // numFeatures x numSamples cells. See variantCellLookup.ts for why the
  // per-cell index it replaced was redundant.
  featureIndexData: ArrayBuffer
  // Where the non-reference bucket starts in the cell arrays (see the two-bucket
  // reorder below). The hit-test binary-searches each bucket, so it needs the
  // boundary; 0 when reference cells are skipped entirely.
  refCellCount: number
  // bp this record inserts relative to the reference, per feature (aligned to
  // `featureIdList`, so a cell reads it through `cellFeatureIndices`). 0 for
  // SNPs and deletions, which the cell's own reference span already draws
  // correctly. This is the one thing a cell's width cannot express: an insertion
  // consumes ~no reference, so a 65 kb and a 1 bp one are both drawn at the 2px
  // floor without it. Multiallelic records report their longest ALT, matching
  // `getAlleleLength` and the `alleleLength()` jexl the docs already teach; a
  // decomposed pangenome callset is biallelic, so there it is exact.
  featureInsertedBp: Int32Array
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
  filteredVariants,
  sources,
  renderingMode,
  referenceDrawingMode,
  featureColor,
  featureGenotypes,
  report,
}: {
  filteredVariants: FilteredVariant[]
  sources: ProcessedSource[]
  renderingMode: string
  referenceDrawingMode: string
  // Optional per-variant color override (e.g. consequence impact). Resolved once
  // per feature; alt-carrying cells take it, ref/no-call cells keep their normal
  // coloring. Undefined = default genotype coloring.
  featureColor?: (feature: Feature) => string | undefined
  // featureId -> genotypes, resolved once for every filtered variant by
  // `computeSampleInfo` (which returns this map for exactly that reason) so the
  // per-cell loops never re-parse a feature's genotype block. Prepopulated for
  // every entry of `filteredVariants` — a sites-only VCF normalizes to {}, not
  // undefined.
  featureGenotypes: ReadonlyMap<string, Record<string, string>>
  report?: ProgressReporter
}): VariantCellData {
  const alleleColorCache: Record<string, string | undefined> = {}
  const drawRef = referenceDrawingMode === 'draw'
  // Packed once — every no-call cell reuses it instead of a per-cell cache hit.
  const noCallAbgr = getCachedABGR(NO_CALL_COLOR)

  const numSources = sources.length
  const maxCells = filteredVariants.length * numSources
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const shapeTypes = new Uint8Array(maxCells)
  const carriesAlt = new Uint8Array(maxCells)
  const isRef = new Uint8Array(maxCells)
  const featureIndices = new Uint32Array(maxCells)
  const featureIdList: string[] = []
  const insertedBp = new Int32Array(filteredVariants.length)
  const featurePositions = new Uint32Array(filteredVariants.length * 2)

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
    isAlt: boolean,
    featureIdx: number,
  ) {
    const ci = cellCount
    // Absolute uint32 genomic positions — the shader hp-splits these against the
    // per-block bpRangeX (no region origin in the uniform). Rendering only: the
    // hit-test and hover highlight read the per-feature `featurePositions`, since
    // every cell of a variant repeats the same span.
    positions[ci * 2] = genomicStart
    positions[ci * 2 + 1] = genomicEnd
    rowIndices[ci] = rowIndex
    colors[ci] = colorAbgr
    shapeTypes[ci] = shape
    carriesAlt[ci] = isAlt ? 1 : 0
    isRef[ci] = isReference ? 1 : 0
    if (isReference) {
      numRefCells++
    }
    featureIndices[ci] = featureIdx
    cellCount++
  }

  let featureIdx = 0
  for (const { feature, mostFrequentAlt } of filteredVariants) {
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
      const samp = hasPhaseSet
        ? (feature.get('samples') as Record<string, Record<string, string[]>>)
        : undefined
      const stringGenotypes = hasPhaseSet
        ? undefined
        : featureGenotypes.get(featureId)!

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
            // Only alt-carrying cells take the per-variant override; ref and
            // no-call keep their own color so a missing call is never painted
            // as though it carried the variant.
            const cellColor =
              overrideColor !== undefined && !isRefCell && c !== NO_CALL_COLOR
                ? overrideColor
                : c
            addCell(
              start,
              end,
              j,
              getCachedABGR(cellColor),
              shape,
              isRefCell,
              !isRefCell && c !== NO_CALL_COLOR,
              featureIdx,
            )
            renderedGenotypes[sampleName] = genotype
          }
        } else if (isNoCall(genotype)) {
          // A missing unphased call (`./.`, `.`) is a no-call, not unphased
          // data — draw it as no-call rather than the black "Unphased" fill.
          addCell(start, end, j, noCallAbgr, shape, false, false, featureIdx)
          renderedGenotypes[sampleName] = genotype
        } else {
          addCell(start, end, j, BLACK_ABGR, shape, false, false, featureIdx)
          renderedGenotypes[sampleName] = genotype
        }
      }
    } else {
      const samp = featureGenotypes.get(featureId)!
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
              c !== REFERENCE_COLOR && c !== NO_CALL_COLOR,
              featureIdx,
            )
            renderedGenotypes[sampleName] = genotype
          }
        }
      }
    }

    const inserted = getInsertedBp(feature)
    featureGenotypeMap[featureId] = {
      alt,
      ref,
      name: featureName,
      description,
      length: bpLen,
      insertedBp: inserted,
      type: featureType,
      genotypes: renderedGenotypes,
    }
    insertedBp[featureIdx] = inserted
    featurePositions[featureIdx * 2] = start
    featurePositions[featureIdx * 2 + 1] = end
    featureIdList.push(featureId)
    featureIdx++
  }

  // Stable two-bucket reorder: ref cells first (when drawn), then non-ref.
  // Skip ref cells entirely when drawRef is false.
  //
  // Cells were appended feature-major, row-minor, and this partition is stable,
  // so *within each bucket* the cells stay sorted by (featureIndex, rowIndex).
  // The hit-test binary-searches that ordering instead of carrying a per-cell
  // spatial index — see variantCellLookup.ts. Anything that reorders cells
  // (a different paint order, a sort) has to preserve it or update that lookup.
  const outCount = drawRef ? cellCount : cellCount - numRefCells
  const refCellCount = drawRef ? numRefCells : 0
  const outPositions = new Uint32Array(outCount * 2)
  const outRowIndices = new Uint32Array(outCount)
  const outColors = new Uint32Array(outCount)
  const outShapeTypes = new Uint8Array(outCount)
  const outCarriesAlt = new Uint8Array(outCount)
  const outFeatureIndices = new Uint32Array(outCount)
  let refPos = 0
  let nonRefPos = refCellCount
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
    outCarriesAlt[w] = carriesAlt[i]!
    outFeatureIndices[w] = featureIndices[i]!
  }

  // One interval per *feature*, not per cell. Every cell of a variant shares its
  // x-extent, so a per-cell index stored numSamples identical copies of each
  // interval to answer a question with only numFeatures distinct answers — and
  // at 21.3 bytes/cell (box + tree nodes + index array) it was the largest thing
  // in the payload by itself, more than every other per-cell array combined:
  // 61 MB for 1000 variants x 3000 samples, against 33 KB here. The row half of
  // the old 2-D query is now arithmetic on the cursor Y, and "is there a cell at
  // (feature, row)" is a binary search over the bucket ordering above.
  //
  // Uint32Array rather than the Float64Array default: genomic positions come
  // straight out of `featurePositions`, so it's the exact domain and no
  // narrowing. `Flatbush.from` reads the element type back off the header on the
  // client. Query bounds may still be fractional or negative; those are compared
  // as plain numbers, never stored.
  //
  // Flatbush requires at least one add() per the constructor-declared count, so
  // the empty case gets a single degenerate entry hit-testing will never match.
  const numFeatures = featureIdList.length
  const featureIndex = new Flatbush(Math.max(numFeatures, 1), 16, Uint32Array)
  if (numFeatures > 0) {
    for (let i = 0; i < numFeatures; i++) {
      featureIndex.add(
        featurePositions[i * 2]!,
        0,
        featurePositions[i * 2 + 1],
        1,
      )
    }
  } else {
    featureIndex.add(0, 0, 0, 0)
  }
  featureIndex.finish()

  return {
    cellPositions: outPositions,
    cellRowIndices: outRowIndices,
    cellColors: outColors,
    cellShapeTypes: outShapeTypes,
    cellCarriesAlt: outCarriesAlt,
    numCells: outCount,
    refCellCount,
    featureGenotypeMap,
    cellFeatureIndices: outFeatureIndices,
    featureIdList,
    featurePositions,
    featureIndexData: featureIndex.data,
    featureInsertedBp: insertedBp,
  }
}
