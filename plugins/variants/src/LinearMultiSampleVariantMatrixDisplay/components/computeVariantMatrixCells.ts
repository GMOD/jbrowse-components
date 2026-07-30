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

import type { FilteredVariant } from '../../shared/minorAlleleFrequencyUtils.ts'
import type {
  ProcessedSource,
  VariantFeatureGenotypes,
} from '../../shared/types.ts'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'

type FeatureData = VariantFeatureGenotypes & { featureId: string }

// GT strings pulled out of the per-sample FORMAT records, i.e. the flat
// `genotypes` shape the tooltip and feature widget read. Only the phase-set path
// needs this, since it reads the heavier `samples` field (the flat map doesn't
// carry PS) rather than the genotypes the filter pass already cached.
function genotypesFromSamples(samp: Record<string, Record<string, string[]>>) {
  const genotypes: Record<string, string> = {}
  for (const sampleName in samp) {
    const gt = samp[sampleName]!.GT?.[0]
    if (gt) {
      genotypes[sampleName] = gt
    }
  }
  return genotypes
}

function makeFeatureData(
  feature: Feature,
  featureId: string,
  genotypes: Record<string, string>,
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
    genotypes,
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
  featureGenotypes,
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
  featureGenotypes: ReadonlyMap<string, Record<string, string>>
  report?: ProgressReporter
}): MatrixCellData {
  const alleleColorCache: Record<string, string | undefined> = {}
  // Packed once — every no-call cell reuses it instead of a per-cell cache hit.
  const noCallAbgr = getCachedABGR(NO_CALL_COLOR)

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

  for (let idx = 0; idx < numFeatures; idx++) {
    report?.()
    const { feature, mostFrequentAlt } = filteredVariants[idx]!
    const featureId = feature.id()
    const overrideColor = featureColor?.(feature)

    if (isPhasedMode) {
      // PS (phase-set) coloring requires per-sample FORMAT data, which only the
      // heavier `samples` field preserves — the flat `genotypes` map doesn't
      // carry it. So the slower samples path runs only when the user asked for
      // phase-set coloring AND this feature actually declares PS. Resolved
      // inside the phased branch (as computeVariantCells does) because a phase
      // set is a per-haplotype fact and only this loop paints one.
      const hasPhaseSet =
        colorByPhaseSet &&
        featureHasPhaseSet(feature.get('FORMAT') as string | undefined)
      const samp = hasPhaseSet
        ? (feature.get('samples') as Record<string, Record<string, string[]>>)
        : undefined
      const stringGenotypes = hasPhaseSet
        ? undefined
        : featureGenotypes.get(featureId)!
      featureData.push(
        makeFeatureData(
          feature,
          featureId,
          samp ? genotypesFromSamples(samp) : stringGenotypes!,
        ),
      )

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
            addCell(idx, j, getCachedABGR(cellColor), isRefCell)
          }
        } else if (isNoCall(genotype)) {
          // A missing unphased call (`./.`, `.`) is a no-call, not unphased
          // data — draw it as no-call rather than the black "Unphased" fill.
          addCell(idx, j, noCallAbgr, false)
        } else {
          addCell(idx, j, BLACK_ABGR, false)
        }
      }
    } else {
      const samp = featureGenotypes.get(featureId)!
      featureData.push(makeFeatureData(feature, featureId, samp))

      for (let j = 0; j < numSources; j++) {
        const { sampleName } = sources[j]!
        const genotype = samp[sampleName]
        if (genotype) {
          const c = getAlleleColor(
            genotype,
            mostFrequentAlt,
            alleleColorCache,
            true,
            overrideColor,
          )
          if (c) {
            addCell(idx, j, getCachedABGR(c), c === REFERENCE_COLOR)
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
