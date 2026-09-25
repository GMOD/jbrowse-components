import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../LinearMultiSampleVariantDisplay/matrix/computeVariantMatrixCells.ts'
import { cellHueOf } from '../shared/cellHue.ts'
import { buildCanonicalRows } from '../shared/getSources.ts'
import {
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'
import { analyzeVariants, simplifyFeatures } from './analyzeVariants.ts'
import { fetchVariantFeatures } from './fetchVariantFeatures.ts'
import { groupFeaturesByRegion } from './groupFeaturesByRegion.ts'
import { orderByScreenPosition } from './orderByScreenPosition.ts'

import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { MatrixCellData } from '../LinearMultiSampleVariantDisplay/matrix/computeVariantMatrixCells.ts'
import type { SampleInfo } from '../shared/types.ts'
import type { SimplifiedVariantFeature } from './analyzeVariants.ts'
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
  // "Phased" rendering-mode entry — see analyzeVariants.
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
// the interned codes `analyzeVariants` built, not a map to be converted at
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
    referenceDrawingMode = 'skip',
    color,
    shadeByDosage = true,
    minorAlleleFrequencyFilter,
    maxMissingnessFilter,
    filters,
    regions,
    statusCallback,
    signal,
    displayedRegionIndices,
    byteLimit,
  } = args

  const adapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })

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

  const features = await fetchVariantFeatures(adapter, regions, args)
  const progressOpts = {
    statusCallback,
    signal,
  }
  const {
    filteredVariants: passing,
    sampleInfo,
    hasPhased,
    hasPhasedOrHaploid,
    hasConsequence,
    hasPhaseSet,
    hasSvType,
    svTypeColors,
    featureGenotypeCodes,
    genotypeDict,
    sampleNames,
  } = await withProgress(
    {
      ...progressOpts,
      label: 'Processing variants',
      total: features.length,
    },
    report =>
      analyzeVariants({
        features,
        minorAlleleFrequencyFilter,
        maxMissingnessFilter,
        filterChain: filters,
        report,
      }),
  )
  // Screen order: the matrix's column order, and the order the anchored sort
  // walks for a variant's neighbours in either mode.
  const filteredVariants = orderByScreenPosition(
    passing,
    regions,
    v => v.feature,
  )
  const simplifiedFeatures = simplifyFeatures(filteredVariants)
  // Resolved after the analysis because the SV-type preset's palette is
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
    // Genomic order within a region, so overlapping records paint later over
    // earlier as they lie in the file, whatever order the merged per-region
    // fetches arrived in.
    const perRegionVariants = groupFeaturesByRegion(
      [...passing].sort(
        (a, b) => a.feature.get('start') - b.feature.get('start'),
      ),
      regions.map((r, i) => ({
        refName: r.refName,
        start: r.start,
        end: r.end,
        displayedRegionIndex: displayedRegionIndices?.[i] ?? i,
      })),
      v => v.feature,
    )
    let total = 0
    for (const list of perRegionVariants.values()) {
      total += list.length
    }
    const perRegionCellData = await withProgress(
      {
        ...progressOpts,
        label: 'Processing variants',
        total,
      },
      report => {
        const result: Record<number, VariantCellData> = {}
        for (const [regionNum, regionVariants] of perRegionVariants) {
          result[regionNum] = computeVariantCells({
            filteredVariants: regionVariants,
            sources: effectiveSources,
            renderingMode,
            referenceDrawingMode,
            featureColor: hue.color,
            featureDomain: hue.domain,
            shadeDosage: shadeByDosage,
            colorByPhaseSet,
            featureGenotypeCodes,
            genotypeDict,
            sampleNames,
            report,
          })
        }
        return result
      },
    )

    // A Set, not a list: a variant spanning two regions ships in both, sharing
    // one `genotypeCodes` array, and handing the same buffer to postMessage
    // twice is a structured-clone error.
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
        label: 'Processing variants',
        total: filteredVariants.length,
      },
      report =>
        computeVariantMatrixCells({
          filteredVariants,
          sources: effectiveSources,
          renderingMode,
          featureColor: hue.color,
          featureDomain: hue.domain,
          shadeDosage: shadeByDosage,
          colorByPhaseSet,
          featureGenotypeCodes,
          genotypeDict,
          sampleNames,
          report,
        }),
    )

    const transferables: ArrayBufferLike[] = [
      cellData.cellFeatureIndices.buffer,
      cellData.cellRowIndices.buffer,
      cellData.cellColors.buffer,
    ]
    for (const fd of cellData.featureData) {
      transferables.push(fd.genotypeCodes.buffer)
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
      transferables,
    )
  }
}
