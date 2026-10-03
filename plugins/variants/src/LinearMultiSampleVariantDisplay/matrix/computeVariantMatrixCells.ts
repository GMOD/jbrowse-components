import { getInsertedBp } from '../../shared/alleleLength.ts'
import { makeHueValueTable } from '../../shared/cellHue.ts'
import { makeSiteStyler } from '../../shared/variantCellStyles.ts'

import type { CellHueValues } from '../../shared/cellHue.ts'
import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource, VariantFeatureInfo } from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

type FeatureData = VariantFeatureInfo & { featureId: string }

function makeFeatureData(
  feature: Feature,
  featureId: string,
  genotypeCodes: Uint32Array,
): FeatureData {
  return {
    // A monomorphic record spells ALT '.', which @gmod/vcf parses to undefined.
    // It still ships (its alleles are called, just all reference) and the matrix
    // always draws its reference cell, so normalize here: `VariantFeatureInfo.alt`
    // is a non-optional contract and every tooltip / feature-widget consumer
    // reads it unguarded.
    alt: (feature.get('ALT') as string[] | undefined) ?? [],
    ref: feature.get('REF') as string,
    name: feature.get('name')!,
    description: feature.get('description') as string,
    length: feature.get('end') - feature.get('start'),
    insertedBp: getInsertedBp(feature),
    type: feature.get('type') ?? '',
    featureId,
    genotypeCodes,
  }
}

export interface MatrixCellData extends CellHueValues {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  // See computeVariantCells.
  cellAltDosage: Uint8Array
  cellCategories: Uint8Array
  numCells: number
  /** Where the non-reference bucket starts; `findCellIndex` searches each. */
  refCellCount: number
  numFeatures: number
  featureData: FeatureData[]
  // `1 << CELL_*` for every cell-color category this pass painted. See
  // computeVariantCells.
  paintedCategories: number
}

export function computeVariantMatrixCells({
  filteredVariants,
  sources,
  renderingMode,
  hueValue,
  colorByPhaseSet,
  featureGenotypeCodes,
  genotypeDict,
  sampleNames,
  report,
}: {
  filteredVariants: FilteredVariant[]
  sources: ProcessedSource[]
  renderingMode: string
  // See computeVariantCells.
  hueValue?: (feature: Feature) => string | undefined
  // Color phased alt cells by FORMAT PS instead of by allele (see
  // computeVariantCells).
  colorByPhaseSet?: boolean
  // Prepopulated for every filtered variant — see computeVariantCells.
  featureGenotypeCodes: ReadonlyMap<string, Uint32Array>
  genotypeDict: readonly string[]
  sampleNames: string[]
  report?: ProgressReporter
}): MatrixCellData {
  const styler = makeSiteStyler({
    sources,
    sampleNames,
    genotypeDict,
    renderingMode,
    // columns always draw reference cells
    drawRef: true,
    colorByPhaseSet,
  })

  const numFeatures = filteredVariants.length
  const numSources = sources.length
  const maxCells = numFeatures * numSources
  // One buffer set written from both ends — reference cells forward from 0,
  // non-reference backward from the end — so the two paint buckets land in a
  // single allocation instead of filling a scratch set and copying it into a
  // second one. Same trick, and the same reason, as computeVariantCells: the
  // scratch set was the largest transient in the worker on this path (13 B/cell
  // held alongside 12 B/cell of output, against 12 B/cell here). The backward
  // half lands reversed and is flipped back below, which keeps both buckets in
  // the feature-major order the two renderers walk.
  const featureIndices = new Float32Array(maxCells)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const altDosage = new Uint8Array(maxCells)
  const categories = new Uint8Array(maxCells)

  // Write cursors for the two buckets. `refEnd` grows up from 0, `nonRefStart`
  // shrinks down from maxCells, so they can never collide before the buffer is
  // full: every genotype contributes at most one cell.
  let refEnd = 0
  let nonRefStart = maxCells

  function addCell(
    featureIdx: number,
    rowIdx: number,
    colorAbgr: number,
    isReference: boolean,
    dosage: number,
    category: number,
  ) {
    const ci = isReference ? refEnd++ : --nonRefStart
    featureIndices[ci] = featureIdx
    rowIndices[ci] = rowIdx
    colors[ci] = colorAbgr
    altDosage[ci] = dosage
    categories[ci] = category
  }

  // Exchange two cells across every parallel array. Defined once (not per
  // iteration), and it only reads the captured buffers, so the reversal below
  // stays allocation-free.
  function swapCells(a: number, b: number) {
    const f = featureIndices[a]!
    featureIndices[a] = featureIndices[b]!
    featureIndices[b] = f
    const r = rowIndices[a]!
    rowIndices[a] = rowIndices[b]!
    rowIndices[b] = r
    const c = colors[a]!
    colors[a] = colors[b]!
    colors[b] = c
    const d = altDosage[a]!
    altDosage[a] = altDosage[b]!
    altDosage[b] = d
    const k = categories[a]!
    categories[a] = categories[b]!
    categories[b] = k
  }

  const featureData: FeatureData[] = []
  const featureColorValues = new Uint32Array(numFeatures)
  const hueValues = makeHueValueTable()
  let paintedCategories = 0
  let altPainted = false

  for (let idx = 0; idx < numFeatures; idx++) {
    report?.()
    const { feature, mostFrequentAlt } = filteredVariants[idx]!
    const featureId = feature.id()
    const codes = featureGenotypeCodes.get(featureId)!
    featureData.push(makeFeatureData(feature, featureId, codes))
    styler.site(feature, codes, mostFrequentAlt)
    altPainted = false
    for (let j = 0; j < numSources; j++) {
      const style = styler.styleAt(j)
      if (style) {
        paintedCategories |= 1 << style.category
        altPainted ||= style.isAlt
        addCell(
          idx,
          j,
          style.abgr,
          style.isRef,
          style.altDosage,
          style.category,
        )
      }
    }

    if (hueValue) {
      featureColorValues[idx] = hueValues.add(hueValue(feature), altPainted)
    }
  }

  // The backward-written bucket sits reversed at [nonRefStart, maxCells): cells
  // appended c1..cN landed as cN..c1. Flip it in place so *within each bucket*
  // the cells are again in feature-major order.
  for (let lo = nonRefStart, hi = maxCells - 1; lo < hi; lo++, hi--) {
    swapCells(lo, hi)
  }

  // Ref cells first, then non-ref, so alt paints over ref. Close the gap that
  // skipped genotypes left between the two cursors; a no-op in the dense case,
  // where they already meet.
  const refCellCount = refEnd
  const numCells = refCellCount + (maxCells - nonRefStart)
  if (nonRefStart !== refCellCount) {
    featureIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    rowIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    colors.copyWithin(refCellCount, nonRefStart, maxCells)
    altDosage.copyWithin(refCellCount, nonRefStart, maxCells)
    categories.copyWithin(refCellCount, nonRefStart, maxCells)
  }

  // Trim to the used prefix. `slice` copies, so it is skipped when nothing was
  // skipped and the buffers are already exact — precisely the case that costs
  // memory, a fully-genotyped VCF filling every cell. Consumers read `numCells`,
  // never `.length`.
  const trim = numCells !== maxCells
  return {
    cellFeatureIndices: trim
      ? featureIndices.slice(0, numCells)
      : featureIndices,
    cellRowIndices: trim ? rowIndices.slice(0, numCells) : rowIndices,
    cellColors: trim ? colors.slice(0, numCells) : colors,
    cellAltDosage: trim ? altDosage.slice(0, numCells) : altDosage,
    cellCategories: trim ? categories.slice(0, numCells) : categories,
    numCells,
    refCellCount,
    numFeatures,
    featureData,
    paintedCategories,
    featureColorValues,
    ...hueValues.result(),
  }
}
