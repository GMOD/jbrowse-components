import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { cellHueOf } from '../shared/cellHue.ts'
import { buildCanonicalRows } from '../shared/getSources.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'
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

export type { SimplifiedVariantFeature }

// What the paint loops reported, as the three legend booleans and the domain
// list. One place for both modes, so the regular display's per-region merge and
// the matrix's single pass cannot answer differently.
function paintedLegendFlags(
  passes: { paintedCategories: number; paintedDomain: string[] }[],
) {
  let mask = 0
  const domain = new Set<string>()
  for (const pass of passes) {
    mask |= pass.paintedCategories
    for (const value of pass.paintedDomain) {
      domain.add(value)
    }
  }
  return {
    hasSecondaryAlt: (mask & (1 << CELL_ALT_SECONDARY)) !== 0,
    hasUnphased: (mask & (1 << CELL_UNPHASED)) !== 0,
    hasNoCall: (mask & (1 << CELL_NO_CALL)) !== 0,
    paintedDomain: [...domain],
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
  // What the cell loops actually painted: a secondary-alt fill, a black
  // unphased fill, a no-call fill. Each drives its legend entry, so the entry
  // means one is in the fetched cell data rather than that the data could
  // produce one. Merged across every fetched region, which for the regular
  // display is wider than the viewport.
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // The cell scale's domain values an alt cell was painted for in the fetched
  // cell data — the impact tiers or SV classes the legend lists.
  paintedDomain: string[]
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
  /**
   * What the index quoted for the largest fetched region, when the fetch
   * carried a `byteLimit` and the adapter had an estimate to give. Carried back
   * on the success path too, so the display's gate re-anchors its stored
   * estimate on every fetch rather than only on the ones it refuses.
   */
  bytes?: number
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
    color,
    shadeByDosage,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    regions,
    adapterConfig,
    sessionId,
    statusCallback,
    signal,
    displayedRegionIndices,
    byteLimit,
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

  // The gate, and the first thing this fetch awaits on the adapter: the index
  // estimate for the largest region, so an over-budget viewport is refused
  // before a single genotype is downloaded.
  const { bytes, tooLarge } = await measureRegionBytes({
    dataAdapter: adapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

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
    signal,
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
    hasConsequence,
    hasPhaseSet,
    hasSvType,
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
  // Resolved after computeSampleInfo because the SV-type preset's palette is
  // dealt over the types actually present.
  //
  // Phase-set hues are gated on phased mode here rather than in each cell loop:
  // a phase set is a per-haplotype fact and only the phased loop paints one.
  // `getVariantColorScales` resolves the same combination the same way, so the
  // key and the cells agree.
  const hue = cellHueOf(color, {
    jexl: pluginManager.jexl,
    svTypeColors,
    renderingMode,
  })
  const colorByPhaseSet = hue.byPhaseSet ?? false

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
              featureColor: hue.color,
              featureDomain: hue.domain,
              shadeDosage: shadeByDosage ?? true,
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
            featureColor: hue.color,
            featureDomain: hue.domain,
            shadeDosage: shadeByDosage ?? true,
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
    const painted = paintedLegendFlags(Object.values(perRegionCellData))
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
        ...painted,
        hasConsequence,
        hasSvType,
        hasPhaseSet,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        bytes,
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
          featureColor: hue.color,
          featureDomain: hue.domain,
          shadeDosage: shadeByDosage ?? true,
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
        ...paintedLegendFlags([cellData]),
        hasConsequence,
        hasSvType,
        hasPhaseSet,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        bytes,
        ...cellData,
      },
      [...transferables],
    )
  }
}
