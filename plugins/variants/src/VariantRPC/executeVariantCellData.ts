import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'
import { withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { cellHueReaderOf } from '../shared/cellHue.ts'
import { buildCanonicalRows } from '../shared/getSources.ts'
import {
  CELL_ALT_NO_PHASE_SET,
  CELL_ALT_SECONDARY,
  CELL_NO_CALL,
  CELL_UNPHASED,
} from '../shared/variantCellStyles.ts'
import { analyzeVariants, simplifyFeatures } from './analyzeVariants.ts'
import { fetchVariantFeatures } from './fetchVariantFeatures.ts'
import { groupFeaturesByRegion } from './groupFeaturesByRegion.ts'
import { orderByScreenPosition } from './orderByScreenPosition.ts'

import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { CellHueRead } from '../shared/cellHue.ts'
import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SimplifiedVariantFeature } from './analyzeVariants.ts'
import type { GetCellDataArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

// What the paint loops reported, as the three legend booleans, merged over
// every payload of the fetch.
function paintedLegendFlags(passes: { paintedCategories: number }[]) {
  let mask = 0
  for (const pass of passes) {
    mask |= pass.paintedCategories
  }
  return {
    hasSecondaryAlt: (mask & (1 << CELL_ALT_SECONDARY)) !== 0,
    hasAltWithoutPhaseSet: (mask & (1 << CELL_ALT_NO_PHASE_SET)) !== 0,
    hasUnphased: (mask & (1 << CELL_UNPHASED)) !== 0,
    hasNoCall: (mask & (1 << CELL_NO_CALL)) !== 0,
  }
}

// Which records each payload draws, under the key of the block that draws it.
// At genomic positions, each displayed region's in file order, so overlapping
// records paint later over earlier whatever order the merged fetches arrived
// in. In columns, every record once under 0, in the screen order its column
// index is. A block with no records still gets a payload, an empty one: the
// canvas counts as painted only once a block on screen has a payload, so a
// window with no records at all would otherwise read as loading for good.
function recordsByBlock({
  layout,
  regions,
  displayedRegionIndices,
  filteredVariants,
}: {
  layout: GetCellDataArgs['layout']
  regions: Region[]
  displayedRegionIndices?: number[]
  // in screen order
  filteredVariants: FilteredVariant[]
}): Map<number, FilteredVariant[]> {
  if (layout === 'columns') {
    return new Map([[0, filteredVariants]])
  }
  return groupFeaturesByRegion(
    [...filteredVariants].sort(
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
}

interface CellDataBase {
  samplePloidy: Record<string, number>
  // Names the worker's row list, aligned to the `cellRowIndices` the cell arrays
  // carry: `rowNames[cellRowIndices[i]]` is the row cell `i` belongs to. The
  // client turns these into screen rows by name — nothing positional survives
  // the boundary. Haplotype rows are named by the shared "<sampleName> HP<n>"
  // convention, so they match the client's expansion exactly.
  rowNames: string[]
  // Whether any called genotype is phased OR haploid, which is the predicate the
  // phased painter uses (`isPhasedOrHaploid`) and so the one that gates the
  // "Phased" rendering-mode entry — see analyzeVariants.
  hasPhasedOrHaploid: boolean
  // What the cell loop actually painted: a secondary-alt fill, a black
  // unphased fill, a no-call fill. Each drives its legend entry, so the entry
  // means one is in the fetched cell data rather than that the data could
  // produce one. Merged across every fetched region, which at genomic
  // positions is wider than the viewport. A secondary alt counts whether or not
  // a `color` hue repaints it; the key lists it under the genotype colors
  // alone.
  hasSecondaryAlt: boolean
  hasAltWithoutPhaseSet: boolean
  hasUnphased: boolean
  hasNoCall: boolean
  // The `color` the worker read each variant's `colorValues` for, so a payload
  // read for another field is never painted through the current one's scale.
  colorRead: CellHueRead
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

export type CellDataResult = CellDataBase & {
  // One payload per block the layout draws: under each displayed region's
  // index at genomic positions, under 0 for the columns, whose one block runs
  // across the whole window. A region with no variants has no entry.
  perRegionCellData: Record<number, VariantCellData>
}

export async function executeVariantCellData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiSampleVariantGetCellData'>
}) {
  const {
    layout,
    sampleFilter,
    unit,
    referenceDrawingMode = 'skip',
    color,
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
    samplePloidy,
    hasPhasedOrHaploid,
    hasConsequence,
    hasPhaseSet,
    hasSvType,
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
  // walks for a variant's neighbours in either layout.
  const filteredVariants = orderByScreenPosition(
    passing,
    regions,
    v => v.feature,
  )
  const simplifiedFeatures = simplifyFeatures(filteredVariants)
  // Phase-set hues are gated on phased mode here rather than in the cell loop:
  // a phase set is a per-haplotype fact and only the phased loop paints one.
  // `getVariantColorScales` resolves the same combination the same way, so the
  // key and the cells agree.
  const hue = cellHueReaderOf(color, {
    jexl: pluginManager.jexl,
    unit,
  })
  const colorByPhaseSet = hue.byPhaseSet ?? false

  // The worker's own row list, in its own arbitrary order — see
  // buildCanonicalRows. Phased mode expands to per-haplotype rows here, using
  // the ploidy just computed, which is also why the client cannot send
  // expanded sources: ploidy is fetch-derived and putting it in `rpcProps()`
  // would loop.
  const effectiveSources = buildCanonicalRows({
    samplePloidy,
    sampleFilter,
    unit,
  })
  const rowNames = effectiveSources.map(s => s.name)

  const blocks = recordsByBlock({
    layout,
    regions,
    displayedRegionIndices,
    filteredVariants,
  })
  let total = 0
  for (const list of blocks.values()) {
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
      for (const [key, blockVariants] of blocks) {
        result[key] = computeVariantCells({
          filteredVariants: blockVariants,
          sources: effectiveSources,
          unit,
          referenceDrawingMode,
          hueValue: hue.value,
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
  const payloads = Object.values(perRegionCellData)
  const transferables = new Set<ArrayBufferLike>()
  for (const data of payloads) {
    for (const info of data.featureInfo) {
      transferables.add(info.genotypeCodes.buffer)
    }
    transferables.add(data.cellRowIndices.buffer)
    transferables.add(data.cellColors.buffer)
    transferables.add(data.cellAltDosage.buffer)
    transferables.add(data.cellFeatureIndices.buffer)
    transferables.add(data.featureIndexData)
    transferables.add(data.featurePositions.buffer)
    transferables.add(data.featureInsertedBp.buffer)
    transferables.add(data.featureColorValues.buffer)
  }

  return rpcResult(
    {
      samplePloidy,
      rowNames,
      hasPhasedOrHaploid,
      colorRead: color,
      ...paintedLegendFlags(payloads),
      hasConsequence,
      hasSvType,
      hasPhaseSet,
      simplifiedFeatures,
      genotypeDict,
      sampleNames,
      bytes,
      perRegionCellData,
    },
    [...transferables],
  )
}
