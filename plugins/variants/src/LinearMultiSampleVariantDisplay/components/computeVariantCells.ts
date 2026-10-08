import Flatbush from '@jbrowse/core/util/flatbush'

import { getInsertedBp } from '../../shared/alleleLength.ts'
import { makeHueValueTable } from '../../shared/cellHue.ts'
import { makeSiteStyler } from '../../shared/variantCellStyles.ts'

import type { CellHueValues } from '../../shared/cellHue.ts'
import type { VariantUnit } from '../../shared/constants.ts'
import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource, VariantFeatureInfo } from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

/**
 * One payload of genotype cells, which both layouts draw from: the genomic
 * layout one per displayed region, the columns layout one for the whole
 * window. A per-cell array holds a cell's own fact; what every cell of a
 * record shares — its span, its glyph, its inserted bp, the record itself —
 * lives once per feature and is reached through `cellFeatureIndices`.
 */
export interface VariantCellData extends CellHueValues {
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  // Fraction of the cell's genotype that is non-reference, as a 0-255 byte (see
  // `altDosageByte`). Reference and no-call cells are 0, so the insertion mark
  // widens only haplotypes that carry the extra sequence. Above zero it also
  // shades the marker, so a het draws paler than a hom.
  cellAltDosage: Uint8Array
  cellFeatureIndices: Uint32Array
  numCells: number
  // where the non-reference bucket starts; the hit-test binary-searches each
  // bucket. 0 when reference cells are skipped
  refCellCount: number
  // in the order the cells index them: column order in the columns layout,
  // paint order in the genomic layout
  featureInfo: VariantFeatureInfo[]
  // Absolute genomic (start, end) interleaved per feature; every cell of a
  // variant shares the span
  featurePositions: Uint32Array
  // spatial index over `featurePositions`, one interval per feature rather than
  // per cell (variantCellLookup.ts)
  featureIndexData: ArrayBuffer
  // bp this record inserts relative to the reference, per feature; 0 for SNPs
  // and deletions. A cell's width cannot express it, since an insertion
  // consumes ~no reference. Multiallelic records report their longest ALT,
  // matching `getAlleleLength` and the `alleleLength()` jexl.
  featureInsertedBp: Int32Array
  // `1 << CELL_*` for every cell-color category this pass painted; the legend
  // lists exactly these
  paintedCategories: number
}

export function computeVariantCells({
  filteredVariants,
  sources,
  unit,
  referenceDrawingMode,
  hueValue,
  colorByPhaseSet,
  featureGenotypeCodes,
  genotypeDict,
  sampleNames,
  report,
}: {
  filteredVariants: FilteredVariant[]
  sources: ProcessedSource[]
  unit: VariantUnit
  referenceDrawingMode: string
  // what the alt cells' hue reads off a variant, once per feature
  hueValue?: (feature: Feature) => string | undefined
  // Explicit, never inferred from the presence of PS: an implicit trigger
  // swaps the alt-allele colors the legend describes
  colorByPhaseSet?: boolean
  // Interned genotype codes aligned to the canonical sample order, from
  // `analyzeVariants`. Holds every entry of `filteredVariants`; a sites-only VCF
  // gets an all-zero row, not undefined.
  featureGenotypeCodes: ReadonlyMap<string, Uint32Array>
  // `genotypeDict[code - 1]`; code 0 means no genotype at this site
  genotypeDict: readonly string[]
  sampleNames: string[]
  report?: ProgressReporter
}): VariantCellData {
  const styler = makeSiteStyler({
    sources,
    sampleNames,
    genotypeDict,
    unit,
    drawRef: referenceDrawingMode === 'draw',
    colorByPhaseSet,
  })
  const numSources = sources.length
  const numFeatures = filteredVariants.length
  const maxCells = numFeatures * numSources
  // One buffer set written from both ends: reference cells forward from 0,
  // non-reference backward from the end, so the two paint buckets share one
  // allocation. The backward half lands reversed and is flipped below to keep
  // the (featureIndex, rowIndex) ordering `findCellIndex` binary-searches.
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const altDosage = new Uint8Array(maxCells)
  const featureIndices = new Uint32Array(maxCells)
  const featureInfo: VariantFeatureInfo[] = []
  const insertedBp = new Int32Array(numFeatures)
  const featurePositions = new Uint32Array(numFeatures * 2)
  const featureColorValues = new Uint32Array(numFeatures)
  const hueValues = makeHueValueTable()

  let paintedCategories = 0
  let altPainted = false
  // The cursors cannot collide before the buffer is full: every genotype
  // contributes at most one cell.
  let refEnd = 0
  let nonRefStart = maxCells

  function addCell(
    rowIndex: number,
    colorAbgr: number,
    isReference: boolean,
    dosage: number,
    featureIdx: number,
  ) {
    const ci = isReference ? refEnd++ : --nonRefStart
    rowIndices[ci] = rowIndex
    colors[ci] = colorAbgr
    altDosage[ci] = dosage
    featureIndices[ci] = featureIdx
  }

  function swapCells(a: number, b: number) {
    const r = rowIndices[a]!
    rowIndices[a] = rowIndices[b]!
    rowIndices[b] = r
    const c = colors[a]!
    colors[a] = colors[b]!
    colors[b] = c
    const t = altDosage[a]!
    altDosage[a] = altDosage[b]!
    altDosage[b] = t
    const f = featureIndices[a]!
    featureIndices[a] = featureIndices[b]!
    featureIndices[b] = f
  }

  let featureIdx = 0
  for (const { feature, mostFrequentAlt } of filteredVariants) {
    report?.()
    const featureId = feature.id()
    const start = feature.get('start')
    const end = feature.get('end')
    const codes = featureGenotypeCodes.get(featureId)!
    styler.site(feature, codes, mostFrequentAlt)
    altPainted = false
    for (let j = 0; j < numSources; j++) {
      const style = styler.styleAt(j)
      if (style) {
        paintedCategories |= 1 << style.category
        altPainted ||= style.isAlt
        addCell(j, style.abgr, style.isRef, style.altDosage, featureIdx)
      }
    }

    if (hueValue) {
      featureColorValues[featureIdx] = hueValues.add(
        hueValue(feature),
        altPainted,
      )
    }

    const inserted = getInsertedBp(feature)
    featureInfo.push({
      featureId,
      // a monomorphic record's ALT '.' parses to undefined, and consumers read
      // `alt` unguarded
      alt: (feature.get('ALT') as string[] | undefined) ?? [],
      ref: feature.get('REF') as string,
      name: feature.get('name')!,
      description: feature.get('description') as string,
      length: end - start,
      insertedBp: inserted,
      type: feature.get('type') ?? '',
      genotypeCodes: codes,
    })
    insertedBp[featureIdx] = inserted
    featurePositions[featureIdx * 2] = start
    featurePositions[featureIdx * 2 + 1] = end
    featureIdx++
  }

  // Flip the reversed backward bucket so each bucket is again sorted by
  // (featureIndex, rowIndex), the invariant the hit-test binary-searches
  // (variantCellLookup.ts). Any reordering of cells has to preserve it.
  for (let lo = nonRefStart, hi = maxCells - 1; lo < hi; lo++, hi--) {
    swapCells(lo, hi)
  }

  // Ref cells first, then non-ref, so alt paints over ref. Closes the gap that
  // skipped genotypes leave between the cursors.
  const refCellCount = refEnd
  const numCells = refCellCount + (maxCells - nonRefStart)
  if (nonRefStart !== refCellCount) {
    rowIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    colors.copyWithin(refCellCount, nonRefStart, maxCells)
    altDosage.copyWithin(refCellCount, nonRefStart, maxCells)
    featureIndices.copyWithin(refCellCount, nonRefStart, maxCells)
  }

  // `slice` copies, so skip it when the buffers are already exact, which is the
  // fully-genotyped case that costs the most memory
  const trim = numCells !== maxCells

  // One interval per feature, not per cell: every cell of a variant shares its
  // x-extent. The row half of a hit is arithmetic on the cursor Y, and "is there
  // a cell at (feature, row)" is a binary search over the bucket ordering.
  // Uint32Array rather than the Float64Array default, the exact domain of
  // `featurePositions`; `Flatbush.from` reads the element type off the header.
  // Flatbush requires one add() per declared count, so the empty case gets a
  // degenerate entry hit-testing never matches.
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
    cellRowIndices: trim ? rowIndices.slice(0, numCells) : rowIndices,
    cellColors: trim ? colors.slice(0, numCells) : colors,
    cellAltDosage: trim ? altDosage.slice(0, numCells) : altDosage,
    numCells,
    refCellCount,
    cellFeatureIndices: trim
      ? featureIndices.slice(0, numCells)
      : featureIndices,
    featureInfo,
    featurePositions,
    featureIndexData: featureIndex.data,
    featureInsertedBp: insertedBp,
    paintedCategories,
    featureColorValues,
    ...hueValues.result(),
  }
}
