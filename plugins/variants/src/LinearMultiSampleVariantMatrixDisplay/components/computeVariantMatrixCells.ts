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

import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type { ProcessedSource, VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantCellStyle } from '../../shared/variantCellStyles.ts'
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

export interface MatrixCellData {
  cellFeatureIndices: Float32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  numCells: number
  numFeatures: number
  featureData: FeatureData[]
}

export function computeVariantMatrixCells({
  filteredVariants,
  sources,
  renderingMode,
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
  // Optional per-variant color override (see computeVariantCells).
  featureColor?: (feature: Feature) => string | undefined
  // Color phased alt cells by FORMAT PS instead of by allele (see
  // computeVariantCells).
  colorByPhaseSet?: boolean
  // Prepopulated for every filtered variant — see computeVariantCells.
  featureGenotypeCodes: ReadonlyMap<string, Uint32Array>
  genotypeDict: readonly string[]
  sampleNames: string[]
  report?: ProgressReporter
}): MatrixCellData {
  // See computeVariantCells: each source's column in the code arrays, resolved
  // once instead of hashing a sample name per cell.
  const sourceSampleIndices = buildSourceSampleIndices(sources, sampleNames)

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
  ) {
    const ci = isReference ? refEnd++ : --nonRefStart
    featureIndices[ci] = featureIdx
    rowIndices[ci] = rowIdx
    colors[ci] = colorAbgr
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
  }

  const featureData: FeatureData[] = []

  const isPhasedMode = renderingMode === 'phased'
  const numHaplotypes = countHaplotypes(sources)
  // Per-site genotype -> cell style memos, allocated once and cleared per
  // feature (their entries bake in that feature's `mostFrequentAlt` and
  // override color). Same reason as computeVariantCells: a site with thousands
  // of samples carries a handful of distinct genotype strings, so this keeps
  // the color work O(sites x distinct genotypes) instead of O(cells) — and,
  // same as there, they are indexed by genotype code rather than keyed by
  // string, with only the codes a site used cleared between features.
  const numCodes = genotypeDict.length + 1
  const alleleCountStyles = new Array<VariantCellStyle | null | undefined>(
    numCodes,
  )
  const phasedStyles = new Array<(VariantCellStyle | null)[] | undefined>(
    numCodes,
  )
  const touchedCodes: number[] = []
  // Per-sample phase sets, filled per feature only when phase-set coloring is
  // on. Allocated once so the fill reuses one pair of typed arrays.
  const phaseSets = makePhaseSetReader(sampleNames)
  // Its style twin, owning one scratch cell for the same reason.
  const phaseSetStyle = makePhaseSetStyler()

  for (let idx = 0; idx < numFeatures; idx++) {
    report?.()
    const { feature, mostFrequentAlt } = filteredVariants[idx]!
    const featureId = feature.id()
    const overrideColor = featureColor?.(feature)
    for (let t = 0; t < touchedCodes.length; t++) {
      const c = touchedCodes[t]!
      alleleCountStyles[c] = undefined
      phasedStyles[c] = undefined
    }
    touchedCodes.length = 0
    const codes = featureGenotypeCodes.get(featureId)!
    featureData.push(makeFeatureData(feature, featureId, codes))

    if (isPhasedMode) {
      // PS (phase-set) coloring reads a second FORMAT field per sample, so it
      // runs only when the user asked for it AND this feature declares PS.
      // Resolved inside the phased branch (as computeVariantCells does) because
      // a phase set is a per-haplotype fact and only this loop paints one.
      // `read` answers false for a feature that can't report FORMAT ranges, and
      // the loop then paints by allele.
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
            // the matrix always draws reference cells and greys the background
            // in CSS, so `referenceDrawingMode: 'skip'` never reaches here
            true,
            overrideColor,
          )
          if (style) {
            addCell(idx, j, style.abgr, style.isRef)
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
              true,
              overrideColor,
            )
            phasedStyles[code] = byHp
            touchedCodes.push(code)
          }
          const style = byHp[HP!]
          if (style) {
            addCell(idx, j, style.abgr, style.isRef)
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
              true,
              overrideColor,
            )
            alleleCountStyles[code] = style
            touchedCodes.push(code)
          }
          if (style) {
            addCell(idx, j, style.abgr, style.isRef)
          }
        }
      }
    }
  }

  // The backward-written bucket sits reversed at [nonRefStart, maxCells): cells
  // appended c1..cN landed as cN..c1. Flip it in place so *within each bucket*
  // the cells are again in feature-major order.
  for (let lo = nonRefStart, hi = maxCells - 1; lo < hi; lo++, hi--) {
    swapCells(lo, hi)
  }

  // Ref cells first, then non-ref, so alt paints over ref (the matrix always
  // draws ref, unlike the regular variant display — "skip" mode is a grey
  // background there). Close the gap that skipped genotypes left between the two
  // cursors; a no-op in the dense case, where they already meet.
  const refCellCount = refEnd
  const numCells = refCellCount + (maxCells - nonRefStart)
  if (nonRefStart !== refCellCount) {
    featureIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    rowIndices.copyWithin(refCellCount, nonRefStart, maxCells)
    colors.copyWithin(refCellCount, nonRefStart, maxCells)
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
    numCells,
    numFeatures,
    featureData,
  }
}
