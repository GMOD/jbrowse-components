import { readConfigValue } from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { PHASE_SET_COLOR } from '../shared/getPhasedColor.ts'
import { buildCanonicalRows } from '../shared/getSources.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  getVariantImpactColor,
} from '../shared/variantConsequence.ts'
import { SV_TYPE_COLOR, getVariantSvType } from '../shared/variantSvType.ts'
import { computeSampleInfo } from './computeSampleInfo.ts'
import { groupFeaturesByRegion } from './groupFeaturesByRegion.ts'
import { orderByScreenPosition } from './orderByScreenPosition.ts'

import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { MatrixCellData } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SampleInfo } from '../shared/types.ts'
import type { SimplifiedVariantFeature } from './computeSampleInfo.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export type { SimplifiedVariantFeature }

// Resolve the `featureColor` setting to a per-feature color function, or
// undefined for the default genotype coloring. This runs once per *feature* (not
// per cell), so the jexl path costs O(variants), not O(cells). The built-in
// consequence preset skips jexl entirely via the native impact-color function.
function makeFeatureColor(
  featureColor: string | undefined,
  jexl: JexlInstance,
  svTypeColors: Record<string, string>,
): ((feature: Feature) => string | undefined) | undefined {
  if (!featureColor) {
    return undefined
  }
  if (featureColor === CONSEQUENCE_IMPACT_JEXL) {
    return getVariantImpactColor
  }
  if (featureColor === SV_TYPE_COLOR) {
    return feature => svTypeColors[getVariantSvType(feature)]
  }
  if (featureColor === PHASE_SET_COLOR) {
    // Per-(feature, sample), not per-feature — the cell loops read PS out of
    // FORMAT themselves, driven by the `colorByPhaseSet` flag.
    return undefined
  }
  const cfg = { color: featureColor }
  return feature => {
    try {
      const css = readConfigValue(cfg, 'color', feature, jexl)
      return typeof css === 'string' ? css : undefined
    } catch {
      return undefined
    }
  }
}

interface CellDataBase {
  sampleInfo: Record<string, SampleInfo>
  // Names the worker's row list, aligned to the `cellRowIndices` the cell arrays
  // carry: `rowNames[cellRowIndices[i]]` is the row cell `i` belongs to. The
  // client turns these into screen rows by name — nothing positional survives
  // the boundary. Haplotype rows are named by the shared "<sampleName> HP<n>"
  // convention, so they match the client's expansion exactly.
  rowNames: string[]
  hasPhased: boolean
  // Whether any called genotype is phased OR haploid, which is the predicate the
  // phased painter uses (`isPhasedOrHaploid`) and so the one that gates the
  // "Phased" rendering-mode entry — see computeSampleInfo.
  hasPhasedOrHaploid: boolean
  // Whether any variant site is multiallelic (drives the "Other alt allele"
  // legend entry), whether any genotype call is unphased (drives the "Unphased"
  // legend entry in phased mode), and whether any genotype is a no-call (drives
  // the "No call" legend entry in phased mode). Computed here because the
  // simplified features sent to the client no longer carry ALT/genotypes.
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // Whether any visible variant carries a SnpEff/VEP annotation, gating the
  // "Color by...→Consequence impact" menu option.
  hasConsequence: boolean
  // Whether any visible variant is a structural variant, gating the "Color
  // by...→SV type" menu option, and the color assigned to each present SV type
  // so the legend swatches match the painted cells exactly.
  hasSvType: boolean
  // Whether any visible variant declares a phase set (PS in FORMAT), gating the
  // "Color by...→Phase set" menu option.
  hasPhaseSet: boolean
  svTypeColors: Record<string, string>
  simplifiedFeatures: SimplifiedVariantFeature[]
  // Interned genotype payload (see shared/genotypeCodec.ts): the distinct
  // genotype strings, and the canonical sample order that each feature's
  // `genotypeCodes` Uint32Array is aligned to.
  genotypeDict: string[]
  sampleNames: string[]
}

// The cell computations already emit the shipped shape — their genotypes are
// the interned codes `computeSampleInfo` built, not a map to be converted at
// the boundary.
export type ShippedRegionData = VariantCellData
type ShippedMatrixData = MatrixCellData

export type CellDataResult =
  | (CellDataBase & {
      mode: 'regular'
      perRegionCellData: Record<number, ShippedRegionData>
    })
  | (CellDataBase & ShippedMatrixData & { mode: 'matrix' })

export async function executeVariantCellData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiSampleVariantGetCellData'>
}) {
  const {
    mode,
    sampleFilter,
    renderingMode,
    referenceDrawingMode,
    featureColor,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    regions,
    adapterConfig,
    sessionId,
    statusCallback,
    stopToken,
    displayedRegionIndices,
  } = args

  // Only regular mode consumes per-region grouping (it ships one cell blob per
  // displayed region); matrix mode flattens back to a single flat list, so skip
  // the grouping + per-region filtering entirely for it.
  const regionLookup =
    mode === 'regular' && displayedRegionIndices
      ? regions.map((r, i) => ({
          refName: r.refName,
          start: r.start,
          end: r.end,
          displayedRegionIndex: displayedRegionIndices[i]!,
        }))
      : undefined

  const adapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig,
  })

  const rawFeatures = await updateStatus(
    'Downloading features',
    statusCallback,
    () => adapter.getFeaturesInMultipleRegionsArray(regions, args),
  )

  const genotypesCache = new Map<string, Record<string, string>>()

  const perRegionRawFeatures = regionLookup
    ? groupFeaturesByRegion(rawFeatures, regionLookup)
    : undefined

  const progressOpts = {
    statusCallback,
    stopToken,
  }

  let filteredVariants: FilteredVariant[]
  let perRegionFilteredVariants: Map<number, FilteredVariant[]> | undefined
  if (perRegionRawFeatures) {
    perRegionFilteredVariants = await withProgress(
      {
        ...progressOpts,
        label: 'Filtering variants',
        total: rawFeatures.length,
      },
      report => {
        // one shared reporter spans all regions: per-region calls accumulate
        // into one global bar with no offset bookkeeping
        const result = new Map<number, FilteredVariant[]>()
        for (const [regionNum, features] of perRegionRawFeatures) {
          result.set(
            regionNum,
            getFilteredVariants({
              features,
              minorAlleleFrequencyFilter,
              maxMissingnessFilter,
              filterChain: filters,
              genotypesCache,
              report,
            }),
          )
        }
        return result
      },
    )
    const allFilteredVariants: FilteredVariant[] = []
    for (const regionVariants of perRegionFilteredVariants.values()) {
      for (const variant of regionVariants) {
        allFilteredVariants.push(variant)
      }
    }
    filteredVariants = allFilteredVariants
  } else {
    filteredVariants = await withProgress(
      {
        ...progressOpts,
        label: 'Filtering variants',
        total: rawFeatures.length,
      },
      report =>
        getFilteredVariants({
          features: rawFeatures,
          minorAlleleFrequencyFilter,
          maxMissingnessFilter,
          filterChain: filters,
          genotypesCache,
          report,
        }),
    )
    if (mode === 'matrix') {
      // The list order is the column order here, so it has to be the on-screen
      // order or the connector lines cross. Regular mode draws each variant at
      // its own genomic position and doesn't care.
      filteredVariants = orderByScreenPosition(
        filteredVariants,
        regions,
        v => v.feature,
      )
    }
  }

  const {
    sampleInfo,
    hasPhased,
    hasPhasedOrHaploid,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    hasConsequence,
    hasPhaseSet,
    svTypeColors,
    simplifiedFeatures,
    featureGenotypeCodes,
    genotypeDict,
    sampleNames,
  } = await withProgress(
    {
      ...progressOpts,
      label: 'Analyzing variants',
      total: filteredVariants.length,
    },
    report => computeSampleInfo(filteredVariants, genotypesCache, report),
  )
  const hasSvType = Object.keys(svTypeColors).length > 0

  // Resolved after computeSampleInfo because the SV-type preset's color map is
  // built from the types actually present (see makeFeatureColor / svTypeColors).
  const featureColorFn = makeFeatureColor(
    featureColor,
    pluginManager.jexl,
    svTypeColors,
  )
  // Explicit, not inferred from the data: PS coloring used to switch itself on
  // whenever a FORMAT carried PS, which silently replaced the alt-allele colors
  // the legend was still describing and gave no way back.
  //
  // Gated on phased mode here rather than in each cell loop, because a phase set
  // is a per-haplotype fact and only the phased loop paints one: the allele-count
  // loop never reads PS, so outside phased mode this only bought the heavy
  // per-sample `samples` read (the flat `genotypes` map doesn't carry PS) for
  // cells that then paint by genotype anyway. `getVariantLegendSections` resolves
  // the same combination the same way, so the key and the cells agree. Reachable
  // because the two settings are independent: a config can declare both, and
  // switching rendering mode leaves `featureColor` alone.
  const colorByPhaseSet =
    featureColor === PHASE_SET_COLOR && renderingMode === 'phased'

  // The worker's own row list, in its own arbitrary order — see
  // buildCanonicalRows. Phased mode expands to per-haplotype rows here, using
  // the sampleInfo just computed, which is also why the client cannot send
  // expanded sources: sampleInfo is fetch-derived and putting it in `rpcProps()`
  // would loop.
  const effectiveSources = buildCanonicalRows({
    sampleInfo,
    sampleFilter,
    renderingMode,
  })
  const rowNames = effectiveSources.map(s => s.name)

  if (mode === 'regular') {
    const perRegionCellData = await withProgress(
      {
        ...progressOpts,
        label: 'Computing variant cells',
        total: filteredVariants.length,
      },
      report => {
        if (perRegionFilteredVariants) {
          // one shared reporter spans all regions: it owns the running counter,
          // so per-region calls accumulate into one global bar with no offset
          // bookkeeping
          const result: Record<number, VariantCellData> = {}
          for (const [regionNum, regionMafs] of perRegionFilteredVariants) {
            result[regionNum] = computeVariantCells({
              filteredVariants: regionMafs,
              sources: effectiveSources,
              renderingMode,
              referenceDrawingMode: referenceDrawingMode ?? 'skip',
              featureColor: featureColorFn,
              colorByPhaseSet,
              featureGenotypeCodes,
              genotypeDict,
              sampleNames,
              report,
            })
          }
          return result
        }
        return {
          0: computeVariantCells({
            filteredVariants,
            sources: effectiveSources,
            renderingMode,
            referenceDrawingMode: referenceDrawingMode ?? 'skip',
            featureColor: featureColorFn,
            colorByPhaseSet,
            featureGenotypeCodes,
            genotypeDict,
            sampleNames,
            report,
          }),
        }
      },
    )

    // A Set, not a list: one `genotypeCodes` array is now shared by every
    // reference to its feature rather than rebuilt per shipped entry, and
    // `getFeaturesInMultipleRegions` merges its per-region queries without
    // deduping, so a variant spanning two of them arrives twice. Handing the
    // same buffer to postMessage twice is a structured-clone error.
    const transferables = new Set<ArrayBufferLike>()
    const shippedPerRegion: Record<number, ShippedRegionData> = {}
    for (const [k, data] of Object.entries(perRegionCellData)) {
      shippedPerRegion[Number(k)] = data
      for (const id in data.featureGenotypeMap) {
        transferables.add(data.featureGenotypeMap[id]!.genotypeCodes.buffer)
      }
      transferables.add(data.cellPositions.buffer)
      transferables.add(data.cellRowIndices.buffer)
      transferables.add(data.cellColors.buffer)
      transferables.add(data.cellShapeTypes.buffer)
      transferables.add(data.cellAltDosage.buffer)
      transferables.add(data.cellFeatureIndices.buffer)
      transferables.add(data.featureIndexData)
      transferables.add(data.featurePositions.buffer)
      transferables.add(data.featureInsertedBp.buffer)
      transferables.add(data.featureColors.buffer)
    }

    return rpcResult(
      {
        mode: 'regular' as const,
        sampleInfo,
        rowNames,
        hasPhased,
        hasPhasedOrHaploid,
        hasSecondaryAlt,
        hasUnphased,
        hasNoCall,
        hasConsequence,
        hasSvType,
        hasPhaseSet,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        perRegionCellData: shippedPerRegion,
      },
      [...transferables],
    )
  } else {
    const cellData = await withProgress(
      {
        ...progressOpts,
        label: 'Computing variant matrix cells',
        total: filteredVariants.length,
      },
      report =>
        computeVariantMatrixCells({
          filteredVariants,
          sources: effectiveSources,
          renderingMode,
          featureColor: featureColorFn,
          colorByPhaseSet,
          featureGenotypeCodes,
          genotypeDict,
          sampleNames,
          report,
        }),
    )

    // See the regular branch: `featureData` is positional and its entries share
    // one codes array per feature, so a variant that overlapped two displayed
    // regions would otherwise offer the same buffer twice.
    const transferables = new Set<ArrayBufferLike>([
      cellData.cellFeatureIndices.buffer,
      cellData.cellRowIndices.buffer,
      cellData.cellColors.buffer,
    ])
    for (const fd of cellData.featureData) {
      transferables.add(fd.genotypeCodes.buffer)
    }

    return rpcResult(
      {
        mode: 'matrix' as const,
        sampleInfo,
        rowNames,
        hasPhased,
        hasPhasedOrHaploid,
        hasSecondaryAlt,
        hasUnphased,
        hasNoCall,
        hasConsequence,
        hasSvType,
        hasPhaseSet,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        ...cellData,
      },
      [...transferables],
    )
  }
}
