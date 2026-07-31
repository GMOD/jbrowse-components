import Flatbush from '@jbrowse/core/util/flatbush'

import { getInsertedBp } from '../../shared/alleleLength.ts'
import {
  BLACK_ABGR,
  NO_CALL_COLOR,
  REFERENCE_COLOR,
} from '../../shared/constants.ts'
import { getAlleleColor } from '../../shared/drawAlleleCount.ts'
import {
  featureHasPhaseSet,
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
  featureGenotypeMap: Record<string, VariantFeatureGenotypes>
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
  colorByPhaseSet,
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
  // Color phased alt cells by their FORMAT PS (phase set) instead of by allele.
  // Explicit rather than inferred from the presence of PS: the implicit trigger
  // silently swapped the alt-allele colors the legend was describing, with no
  // way to switch back.
  colorByPhaseSet?: boolean
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
  // One buffer set, written from both ends: reference cells forward from 0,
  // non-reference backward from the end. That lands the two paint buckets in a
  // single allocation instead of filling a scratch set and copying it into a
  // second one — which, once the per-cell spatial index went away, was the
  // largest transient left in the worker (23 B/cell scratch held alongside
  // 22 B/cell output: 135 MB peak for 1000 variants x 3000 samples, against
  // 66 MB here). The backward half lands reversed and is flipped back below;
  // that flip is what preserves the stable (featureIndex, rowIndex) ordering
  // `findCellIndex` binary-searches.
  const positions = new Uint32Array(maxCells * 2)
  const rowIndices = new Uint32Array(maxCells)
  const colors = new Uint32Array(maxCells)
  const shapeTypes = new Uint8Array(maxCells)
  const carriesAlt = new Uint8Array(maxCells)
  const featureIndices = new Uint32Array(maxCells)
  const featureIdList: string[] = []
  const insertedBp = new Int32Array(filteredVariants.length)
  const featurePositions = new Uint32Array(filteredVariants.length * 2)

  const featureGenotypeMap: Record<string, VariantFeatureGenotypes> = {}
  // Write cursors for the two buckets. `refEnd` grows up from 0, `nonRefStart`
  // shrinks down from maxCells, so they can never collide before the buffer is
  // full: every genotype contributes at most one cell.
  let refEnd = 0
  let nonRefStart = maxCells

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
    const ci = isReference ? refEnd++ : --nonRefStart
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
    featureIndices[ci] = featureIdx
  }

  // Exchange two cells across every parallel array. Defined once (not per
  // iteration), and it only reads the captured buffers, so the reversal below
  // stays allocation-free.
  function swapCells(a: number, b: number) {
    const p0 = positions[a * 2]!
    const p1 = positions[a * 2 + 1]!
    positions[a * 2] = positions[b * 2]!
    positions[a * 2 + 1] = positions[b * 2 + 1]!
    positions[b * 2] = p0
    positions[b * 2 + 1] = p1
    const r = rowIndices[a]!
    rowIndices[a] = rowIndices[b]!
    rowIndices[b] = r
    const c = colors[a]!
    colors[a] = colors[b]!
    colors[b] = c
    const s = shapeTypes[a]!
    shapeTypes[a] = shapeTypes[b]!
    shapeTypes[b] = s
    const t = carriesAlt[a]!
    carriesAlt[a] = carriesAlt[b]!
    carriesAlt[b] = t
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
    const featureType = feature.get('type') ?? ''
    const bpLen = end - start
    const shape = getShapeType(featureType)
    // A monomorphic record spells ALT '.', which @gmod/vcf parses to undefined.
    // It still ships (its alleles are called, just all reference) and draws a
    // reference cell, so normalize here: `VariantFeatureInfo.alt` is a
    // non-optional contract and every tooltip / feature-widget consumer reads it
    // unguarded.
    const alt = (feature.get('ALT') as string[] | undefined) ?? []
    const ref = feature.get('REF') as string
    const featureName = feature.get('name')!
    const description = feature.get('description') as string
    const sourceGenotypes: Record<string, string> = {}
    // Per-variant override color, resolved once per feature (not per cell);
    // undefined when no override is set, so normal genotype coloring runs.
    const overrideColor = featureColor?.(feature)

    if (renderingMode === 'phased') {
      // PS (phase-set) coloring requires per-sample FORMAT data, which only the
      // heavier `samples` field preserves — the flat `genotypes` map doesn't
      // carry it. So the slower samples path runs only when the user asked for
      // phase-set coloring AND this feature actually declares PS.
      const hasPhaseSet =
        colorByPhaseSet &&
        featureHasPhaseSet(feature.get('FORMAT') as string | undefined)
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
        // Recorded before the color check, not per drawn cell: this map is the
        // genotype record the anchored sort reads, and under
        // `referenceDrawingMode: 'skip'` a hom-ref call paints nothing. Keying
        // it off what was painted made every hom-ref row read as a no-call
        // there while the matrix (which always paints ref) sorted them apart.
        // Costs nothing on the wire — `genotypeCodes` is a fixed
        // Uint16Array(numSamples) either way.
        sourceGenotypes[sampleName] = genotype
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
          }
        } else if (isNoCall(genotype)) {
          // A missing unphased call (`./.`, `.`) is a no-call, not unphased
          // data — draw it as no-call rather than the black "Unphased" fill.
          addCell(start, end, j, noCallAbgr, shape, false, false, featureIdx)
        } else {
          addCell(start, end, j, BLACK_ABGR, shape, false, false, featureIdx)
        }
      }
    } else {
      const samp = featureGenotypes.get(featureId)!
      for (let j = 0; j < numSources; j++) {
        const { sampleName } = sources[j]!
        const genotype = samp[sampleName]
        if (genotype) {
          // See the phased loop: recorded whether or not a cell is painted.
          sourceGenotypes[sampleName] = genotype
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
      genotypes: sourceGenotypes,
    }
    insertedBp[featureIdx] = inserted
    featurePositions[featureIdx * 2] = start
    featurePositions[featureIdx * 2 + 1] = end
    featureIdList.push(featureId)
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
    positions.copyWithin(refCellCount * 2, nonRefStart * 2, maxCells * 2)
    rowIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    colors.copyWithin(refCellCount, nonRefStart, maxCells)
    shapeTypes.copyWithin(refCellCount, nonRefStart, maxCells)
    carriesAlt.copyWithin(refCellCount, nonRefStart, maxCells)
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
    cellPositions: trim ? positions.slice(0, numCells * 2) : positions,
    cellRowIndices: trim ? rowIndices.slice(0, numCells) : rowIndices,
    cellColors: trim ? colors.slice(0, numCells) : colors,
    cellShapeTypes: trim ? shapeTypes.slice(0, numCells) : shapeTypes,
    cellCarriesAlt: trim ? carriesAlt.slice(0, numCells) : carriesAlt,
    numCells,
    refCellCount,
    featureGenotypeMap,
    cellFeatureIndices: trim
      ? featureIndices.slice(0, numCells)
      : featureIndices,
    featureIdList,
    featurePositions,
    featureIndexData: featureIndex.data,
    featureInsertedBp: insertedBp,
  }
}
