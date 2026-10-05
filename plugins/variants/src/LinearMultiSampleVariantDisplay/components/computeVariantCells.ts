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
  // `altDosageByte`). Reference and no-call cells are 0: the insertion mark
  // widens only the haplotypes that actually have the extra sequence, and
  // widening a reference cell would claim every sample carries it. Above zero it
  // also shades the marker, so a het draws paler than a hom.
  cellAltDosage: Uint8Array
  cellFeatureIndices: Uint32Array
  numCells: number
  // Where the non-reference bucket starts in the cell arrays (see the two-bucket
  // reorder below). The hit-test binary-searches each bucket, so it needs the
  // boundary; 0 when reference cells are skipped entirely.
  refCellCount: number
  // The records, in the order the cells index them: the columns layout's
  // column order, the genomic layout's paint order.
  featureInfo: VariantFeatureInfo[]
  // Absolute genomic (start, end) interleaved per feature. Every cell of one
  // variant shares this span, so the hit-test and the hover highlight read it
  // here rather than through a cell.
  featurePositions: Uint32Array
  // Spatial index over `featurePositions` — numFeatures intervals, not
  // numFeatures x numSamples cells. See variantCellLookup.ts for why the
  // per-cell index it replaced was redundant.
  featureIndexData: ArrayBuffer
  // bp this record inserts relative to the reference, per feature. 0 for SNPs
  // and deletions, which the cell's own reference span already draws correctly.
  // This is the one thing a cell's width cannot express: an insertion consumes
  // ~no reference, so a 65 kb and a 1 bp one are both drawn at the 2px floor
  // without it. Multiallelic records report their longest ALT, matching
  // `getAlleleLength` and the `alleleLength()` jexl the docs already teach; a
  // decomposed pangenome callset is biallelic, so there it is exact.
  featureInsertedBp: Int32Array
  // `1 << CELL_*` for every cell-color category this pass actually painted. The
  // legend is built from it, so an entry means "in the fetched cell data"
  // rather than "the site could carry one".
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
  // What the alt cells' hue reads off a variant, once per feature.
  hueValue?: (feature: Feature) => string | undefined
  // Color phased alt cells by their FORMAT PS (phase set) instead of by allele.
  // Explicit rather than inferred from the presence of PS: the implicit trigger
  // silently swapped the alt-allele colors the legend was describing, with no
  // way to switch back.
  colorByPhaseSet?: boolean
  // featureId -> interned genotype codes, aligned to the canonical sample order
  // and resolved once for every filtered variant by `analyzeVariants` (which
  // returns this map for exactly that reason) so the per-cell loop never
  // re-parses a feature's genotype block. Prepopulated for every entry of
  // `filteredVariants` — a sites-only VCF gets an all-zero row, not undefined.
  featureGenotypeCodes: ReadonlyMap<string, Uint32Array>
  // The strings those codes resolve against: `genotypeDict[code - 1]`, with 0
  // meaning the sample has no genotype at this site.
  genotypeDict: readonly string[]
  // The canonical sample order the code arrays are aligned to.
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
  // One buffer set, written from both ends: reference cells forward from 0,
  // non-reference backward from the end. That lands the two paint buckets in a
  // single allocation instead of filling a scratch set and copying it into a
  // second one — which, once the per-cell spatial index went away, was the
  // largest transient left in the worker. The backward half lands reversed and
  // is flipped back below; that flip is what preserves the stable
  // (featureIndex, rowIndex) ordering `findCellIndex` binary-searches.
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
  // Write cursors for the two buckets. `refEnd` grows up from 0, `nonRefStart`
  // shrinks down from maxCells, so they can never collide before the buffer is
  // full: every genotype contributes at most one cell.
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

  // Exchange two cells across every parallel array. Defined once (not per
  // iteration), and it only reads the captured buffers, so the reversal below
  // stays allocation-free.
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
    // This variant's genotypes, resolved once: the codes shipped in
    // `featureInfo` below, and the ones the styler reads. Prepopulated by
    // `analyzeVariants` for every filtered variant.
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
      // A monomorphic record spells ALT '.', which @gmod/vcf parses to
      // undefined. It still ships (its alleles are called, just all reference)
      // and draws a reference cell, so normalize here: `alt` is a non-optional
      // contract and every tooltip / feature-widget consumer reads it
      // unguarded.
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

  // The backward-written bucket sits reversed at [nonRefStart, maxCells): cells
  // appended c1..cN landed as cN..c1. Flip it in place so *within each bucket*
  // the cells are again sorted by (featureIndex, rowIndex) — the invariant the
  // hit-test binary-searches instead of carrying a per-cell spatial index (see
  // variantCellLookup.ts). Anything that reorders cells (a different paint
  // order, a per-cell sort) has to preserve it or rework that lookup.
  for (let lo = nonRefStart, hi = maxCells - 1; lo < hi; lo++, hi--) {
    swapCells(lo, hi)
  }

  // Ref cells first (when drawn), then non-ref, so alt paints over ref. Close
  // the gap that skipped genotypes left between the two cursors; a no-op in the
  // dense case (every sample genotyped at every site, reference cells drawn),
  // where they already meet.
  const refCellCount = refEnd
  const numCells = refCellCount + (maxCells - nonRefStart)
  if (nonRefStart !== refCellCount) {
    rowIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    colors.copyWithin(refCellCount, nonRefStart, maxCells)
    altDosage.copyWithin(refCellCount, nonRefStart, maxCells)
    featureIndices.copyWithin(refCellCount, nonRefStart, maxCells)
  }

  // Trim to the used prefix. `slice` copies, so it is skipped when nothing was
  // skipped and the buffers are already exact — which is precisely the case
  // that costs memory, a fully-genotyped VCF filling every cell.
  const trim = numCells !== maxCells

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
