import { featureDefaultColor } from '@jbrowse/core/ui/palette'
import Flatbush from '@jbrowse/core/util/flatbush'

import { buildSourceSampleIndices } from '../../VariantRPC/computeSampleInfo.ts'
import { getInsertedBp } from '../../shared/alleleLength.ts'
import { featureHasPhaseSet } from '../../shared/getPhasedColor.ts'
import { makePhaseSetReader } from '../../shared/phaseSetReader.ts'
import {
  buildAlleleCountStyle,
  buildPhasedStyles,
  countHaplotypes,
  makePhaseSetStyler,
} from '../../shared/variantCellStyles.ts'
import { getCachedABGR } from '../../shared/variantWebglUtils.ts'
import { SHAPE_RECT, SHAPE_TRI_LEFT } from './variantShape.ts'

import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource, VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantCellStyle } from '../../shared/variantCellStyles.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

export interface VariantCellData {
  // Absolute genomic positions in uint32 (start, end) interleaved.
  // The renderer + shader split via hpSplitUint against the per-block
  // bpRangeX; no region origin is shipped separately.
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellShapeTypes: Uint8Array
  // Fraction of the cell's genotype that is non-reference, as a 0-255 byte (see
  // `altDosageByte`). Reference and no-call cells are 0: the insertion-glyph
  // pass widens only the haplotypes that actually have the extra sequence, and
  // widening a reference cell would claim every sample carries it. Above zero it
  // also shades the marker, so a het draws paler than a hom.
  cellAltDosage: Uint8Array
  numCells: number
  featureGenotypeMap: Record<string, VariantFeatureInfo>
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
  // Packed ABGR per *feature*, aligned to `featureIdList`: what the variant
  // lane paints each record with. The `featureColor` override when one resolves
  // for that record, the default variant color otherwise — so the lane and the
  // alt-carrying cells beneath it are the same color, which is the whole point
  // of drawing them in one display.
  //
  // Per feature and not per cell, so it costs 4 bytes x variants next to the
  // payload's 22 B/cell. It is filled whether or not the lane is switched on:
  // the lane is a render-tier setting (a band resize must not refetch), and the
  // fill is one array write per variant inside a loop that already resolved the
  // color.
  featureColors: Uint32Array
  // The glyph each record draws, per feature, from the same `getShapeType` its
  // cells took. Shipped so the lane can hand it to `drawVariantShape` — the
  // painter the cells and the SVG export already share — and an inversion
  // therefore reads as the same left-pointing triangle in the lane and in every
  // genotype row under it.
  featureShapeTypes: Uint8Array
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
  featureGenotypeCodes,
  genotypeDict,
  sampleNames,
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
  // featureId -> interned genotype codes, aligned to the canonical sample order
  // and resolved once for every filtered variant by `computeSampleInfo` (which
  // returns this map for exactly that reason) so the per-cell loops never
  // re-parse a feature's genotype block. Prepopulated for every entry of
  // `filteredVariants` — a sites-only VCF gets an all-zero row, not undefined.
  featureGenotypeCodes: ReadonlyMap<string, Uint32Array>
  // The strings those codes resolve against: `genotypeDict[code - 1]`, with 0
  // meaning the sample has no genotype at this site.
  genotypeDict: readonly string[]
  // The canonical sample order the code arrays are aligned to.
  sampleNames: string[]
  report?: ProgressReporter
}): VariantCellData {
  const drawRef = referenceDrawingMode === 'draw'
  // Each source's column in the code arrays, resolved once for the whole pass:
  // this loop indexes a typed array where it used to hash a sample name per
  // cell. Phased mode puts several rows on one sample, and they share a column.
  const sourceSampleIndices = buildSourceSampleIndices(sources, sampleNames)
  const numSources = sources.length
  const numHaplotypes = countHaplotypes(sources)
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
  const altDosage = new Uint8Array(maxCells)
  const featureIndices = new Uint32Array(maxCells)
  const featureIdList: string[] = []
  const insertedBp = new Int32Array(filteredVariants.length)
  const featurePositions = new Uint32Array(filteredVariants.length * 2)
  const featureColors = new Uint32Array(filteredVariants.length)
  const featureShapeTypes = new Uint8Array(filteredVariants.length)
  // Packed once — a callset with no `featureColor` override reuses it for every
  // record instead of re-packing the same string per variant.
  const defaultFeatureAbgr = getCachedABGR(featureDefaultColor)

  const featureGenotypeMap: Record<string, VariantFeatureInfo> = {}
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
    dosage: number,
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
    altDosage[ci] = dosage
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
    const t = altDosage[a]!
    altDosage[a] = altDosage[b]!
    altDosage[b] = t
    const f = featureIndices[a]!
    featureIndices[a] = featureIndices[b]!
    featureIndices[b] = f
  }

  // Per-site genotype -> cell style memos, allocated once and cleared per
  // feature (their entries bake in that feature's `mostFrequentAlt` and
  // override color). A site with thousands of samples carries a handful of
  // distinct genotype strings, so this is what keeps the color work O(sites x
  // distinct genotypes) instead of O(cells) — see shared/variantCellStyles.ts.
  //
  // Indexed by genotype code rather than keyed by genotype string: the dict is
  // complete before this runs, so the memo is a plain array sized to it and the
  // per-cell lookup is an array read. Only the codes a site actually used are
  // cleared between features, which is that same handful.
  // Per-sample phase sets, filled per feature only when phase-set coloring is
  // on. Allocated once here so the fill reuses one pair of typed arrays.
  const phaseSets = makePhaseSetReader(sampleNames)
  // Its style twin, owning one scratch cell for the same reason.
  const phaseSetStyle = makePhaseSetStyler()
  const numCodes = genotypeDict.length + 1
  const alleleCountStyles = new Array<VariantCellStyle | null | undefined>(
    numCodes,
  )
  const phasedStyles = new Array<(VariantCellStyle | null)[] | undefined>(
    numCodes,
  )
  const touchedCodes: number[] = []

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
    // This variant's genotypes, resolved once: the codes shipped in
    // `featureGenotypeMap` below, and the genotypes both non-phase-set loops
    // read. Prepopulated by `computeSampleInfo` for every filtered variant.
    const codes = featureGenotypeCodes.get(featureId)!
    // Per-variant override color, resolved once per feature (not per cell);
    // undefined when no override is set, so normal genotype coloring runs.
    const overrideColor = featureColor?.(feature)
    for (let t = 0; t < touchedCodes.length; t++) {
      const c = touchedCodes[t]!
      alleleCountStyles[c] = undefined
      phasedStyles[c] = undefined
    }
    touchedCodes.length = 0

    if (renderingMode === 'phased') {
      // PS (phase-set) coloring reads a second FORMAT field per sample, so it
      // runs only when the user asked for it AND this feature declares PS.
      // `read` answers false for a feature that can't report FORMAT ranges (a
      // non-VCF adapter, a sites-only record), and the loop then paints by
      // allele — the same fallback an absent `samples` field used to give.
      const usePhaseSet =
        colorByPhaseSet &&
        featureHasPhaseSet(feature.get('FORMAT') as string | undefined) &&
        phaseSets.read(feature)
      if (usePhaseSet) {
        // The hue comes from a per-(feature, sample) FORMAT field, so there is
        // nothing site-wide to memoize and this stays on the per-cell style
        // call. GT comes from the interned codes, same as every other branch.
        for (let j = 0; j < numSources; j++) {
          const { HP } = sources[j]!
          const si = sourceSampleIndices[j]!
          const code = si === -1 ? 0 : codes[si]!
          if (code === 0) {
            continue
          }
          const style = phaseSetStyle(
            genotypeDict[code - 1]!,
            HP!,
            mostFrequentAlt,
            phaseSets.present[si] ? phaseSets.value[si] : undefined,
            drawRef,
            overrideColor,
          )
          if (style) {
            addCell(
              start,
              end,
              j,
              style.abgr,
              shape,
              style.isRef,
              style.altDosage,
              featureIdx,
            )
          }
        }
      } else {
        for (let j = 0; j < numSources; j++) {
          const { HP } = sources[j]!
          const si = sourceSampleIndices[j]!
          const code = si === -1 ? 0 : codes[si]!
          if (code === 0) {
            continue
          }
          let byHp = phasedStyles[code]
          if (byHp === undefined) {
            byHp = buildPhasedStyles(
              genotypeDict[code - 1]!,
              mostFrequentAlt,
              numHaplotypes,
              drawRef,
              overrideColor,
            )
            phasedStyles[code] = byHp
            touchedCodes.push(code)
          }
          const style = byHp[HP!]
          if (style) {
            addCell(
              start,
              end,
              j,
              style.abgr,
              shape,
              style.isRef,
              style.altDosage,
              featureIdx,
            )
          }
        }
      }
    } else {
      for (let j = 0; j < numSources; j++) {
        const si = sourceSampleIndices[j]!
        const code = si === -1 ? 0 : codes[si]!
        if (code !== 0) {
          let style = alleleCountStyles[code]
          if (style === undefined) {
            style = buildAlleleCountStyle(
              genotypeDict[code - 1]!,
              mostFrequentAlt,
              drawRef,
              overrideColor,
            )
            alleleCountStyles[code] = style
            touchedCodes.push(code)
          }
          if (style) {
            addCell(
              start,
              end,
              j,
              style.abgr,
              shape,
              style.isRef,
              style.altDosage,
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
      genotypeCodes: codes,
    }
    insertedBp[featureIdx] = inserted
    featurePositions[featureIdx * 2] = start
    featurePositions[featureIdx * 2 + 1] = end
    // The lane's color for this record. `overrideColor` is the same value the
    // alt cells of this variant took above, so the mark and its column agree;
    // with no override set there is no per-genotype color that means anything
    // for a whole record, so it falls to the default the single-variant display
    // paints an uncolored feature with.
    featureColors[featureIdx] =
      overrideColor === undefined
        ? defaultFeatureAbgr
        : getCachedABGR(overrideColor)
    featureShapeTypes[featureIdx] = shape
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
    cellAltDosage: trim ? altDosage.slice(0, numCells) : altDosage,
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
    featureColors,
    featureShapeTypes,
  }
}
