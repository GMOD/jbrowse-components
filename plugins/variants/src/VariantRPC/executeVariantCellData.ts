import { readConfigValue } from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { internGenotype } from '../shared/genotypeCodec.ts'
import { expandSourcesToHaplotypes } from '../shared/getSources.ts'
import { getFilteredVariants } from '../shared/minorAlleleFrequencyUtils.ts'
import {
  CONSEQUENCE_IMPACT_JEXL,
  featureHasConsequence,
  getVariantImpactColor,
} from '../shared/variantConsequence.ts'
import {
  SV_TYPE_COLOR,
  assignSvTypeColors,
  getVariantSvType,
} from '../shared/variantSvType.ts'

import type { GetCellDataArgs } from './types.ts'
import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { MatrixCellData } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type {
  SampleInfo,
  VariantFeatureGenotypes,
  VariantFeatureInfo,
} from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature, ProgressReporter } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

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

export interface SimplifiedVariantFeature {
  id: string
  data: {
    start: unknown
    end: unknown
    refName: unknown
    name: unknown
  }
}

interface CellDataBase {
  sampleInfo: Record<string, SampleInfo>
  hasPhased: boolean
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
  svTypeColors: Record<string, string>
  simplifiedFeatures: SimplifiedVariantFeature[]
  // Interned genotype payload (see shared/genotypeCodec.ts): the distinct
  // genotype strings, and the canonical sample order that each feature's
  // `genotypeCodes` Uint16Array is aligned to.
  genotypeDict: string[]
  sampleNames: string[]
}

// Shipped variants of the compute outputs: the per-feature genotype maps are
// interned to `genotypeCodes` before crossing the RPC boundary.
type ShippedRegionData = Omit<VariantCellData, 'featureGenotypeMap'> & {
  featureGenotypeMap: Record<string, VariantFeatureInfo>
}
type ShippedMatrixData = Omit<MatrixCellData, 'featureData'> & {
  featureData: (VariantFeatureInfo & { featureId: string })[]
}

export type CellDataResult =
  | (CellDataBase & {
      mode: 'regular'
      perRegionCellData: Record<number, ShippedRegionData>
    })
  | (CellDataBase & ShippedMatrixData & { mode: 'matrix' })

// Intern one feature's sample→genotype map into a code array aligned to
// `sampleNames` (0 = no genotype for that sample). Accumulates distinct strings
// into the shared dict so the whole payload references one table.
function internFeatureGenotypes(
  info: VariantFeatureGenotypes,
  sampleIndex: Map<string, number>,
  numSamples: number,
  dict: string[],
  dictIndex: Map<string, number>,
): VariantFeatureInfo {
  const genotypeCodes = new Uint16Array(numSamples)
  for (const sampleName in info.genotypes) {
    const idx = sampleIndex.get(sampleName)
    if (idx !== undefined) {
      genotypeCodes[idx] = internGenotype(
        info.genotypes[sampleName]!,
        dict,
        dictIndex,
      )
    }
  }
  return {
    ref: info.ref,
    alt: info.alt,
    name: info.name,
    description: info.description,
    length: info.length,
    type: info.type,
    genotypeCodes,
  }
}

// Merge one sample's per-feature ploidy/phasing into the running sampleInfo
// (max ploidy seen, phased if ever phased). Monomorphic: always called with
// the same arg types from both genotype representations.
function accumulateSampleInfo(
  sampleInfo: Record<string, SampleInfo>,
  key: string,
  ploidy: number,
  isPhased: boolean,
) {
  const existing = sampleInfo[key]
  if (existing) {
    if (ploidy > existing.maxPloidy) {
      existing.maxPloidy = ploidy
    }
    existing.isPhased ||= isPhased
  } else {
    sampleInfo[key] = { maxPloidy: ploidy, isPhased }
  }
}

function computeSampleInfo(
  mafs: FilteredVariant[],
  genotypesCache: Map<string, Record<string, string>>,
  report?: ProgressReporter,
) {
  const sampleInfo: Record<string, SampleInfo> = {}
  let hasPhased = false
  let hasSecondaryAlt = false
  let hasUnphased = false
  let hasNoCall = false
  let hasConsequence = false
  const svTypes = new Set<string>()

  // Single pass: accumulate sampleInfo/legend flags and build the simplified
  // feature list together. Avoids a second full iteration over mafs (was a
  // separate `mafs.map`) and lets the progress bar track the whole phase.
  const simplifiedFeatures: SimplifiedVariantFeature[] = new Array(mafs.length)
  for (let featureIdx = 0; featureIdx < mafs.length; featureIdx++) {
    report?.(featureIdx)
    const { feature } = mafs[featureIdx]!
    const featureId = feature.id()
    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      hasSecondaryAlt = true
    }
    if (!hasConsequence && featureHasConsequence(feature)) {
      hasConsequence = true
    }
    const svType = getVariantSvType(feature)
    if (svType) {
      svTypes.add(svType)
    }
    let samp = genotypesCache.get(featureId)
    if (!samp) {
      samp = feature.get('genotypes') as Record<string, string>
      genotypesCache.set(featureId, samp)
    }
    for (const key in samp) {
      const val = samp[key]!
      let ploidy = 1
      let called = false
      let missing = false
      let phased = false
      let unphased = false
      for (let i = 0, l = val.length; i < l; i++) {
        const char = val[i]
        if (char === '|') {
          ploidy++
          phased = true
        } else if (char === '/') {
          ploidy++
          unphased = true
        } else if (char === '.') {
          missing = true
        } else {
          called = true
        }
      }
      hasPhased ||= phased
      // A no-call carries a `/` separator but isn't unphased data, so only a
      // genotype with an actual called allele counts toward "Unphased".
      hasUnphased ||= unphased && called
      // Mirror where the renderer actually draws a no-call cell: a phased
      // genotype draws one per missing haplotype allele; an unphased genotype
      // only when it's entirely missing (a partial `0/.` stays black/unphased).
      hasNoCall ||= phased ? missing : !called
      accumulateSampleInfo(sampleInfo, key, ploidy, phased)
    }

    simplifiedFeatures[featureIdx] = {
      id: featureId,
      data: {
        start: feature.get('start'),
        end: feature.get('end'),
        refName: feature.get('refName'),
        name: feature.get('name'),
      },
    }
  }

  return {
    sampleInfo,
    hasPhased,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    hasConsequence,
    svTypeColors: assignSvTypeColors([...svTypes]),
    simplifiedFeatures,
  }
}

export async function executeVariantCellData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetCellDataArgs
}) {
  const {
    mode,
    sources,
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
  // displayed region); matrix mode flattens back to a single `mafs` list, so
  // skip the grouping + per-region filtering entirely for it.
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

  // Group rawFeatures by region. Uses a linear scan over per-refName
  // candidates rather than a pointer advance so features are correctly
  // assigned regardless of emission order from merge(). R (regions per
  // refName) is almost always 1, so the O(N*R) cost is effectively O(N).
  let perRegionRawFeatures: Map<number, typeof rawFeatures> | undefined
  if (regionLookup) {
    const regionsByRefName = new Map<string, typeof regionLookup>()
    for (const r of regionLookup) {
      let list = regionsByRefName.get(r.refName)
      if (!list) {
        list = []
        regionsByRefName.set(r.refName, list)
      }
      list.push(r)
    }
    perRegionRawFeatures = new Map()
    for (const feature of rawFeatures) {
      const refName = feature.get('refName')
      const start = feature.get('start')
      const candidates = regionsByRefName.get(refName)
      if (!candidates) {
        continue
      }
      for (const region of candidates) {
        if (start >= region.start && start < region.end) {
          let list = perRegionRawFeatures.get(region.displayedRegionIndex)
          if (!list) {
            list = []
            perRegionRawFeatures.set(region.displayedRegionIndex, list)
          }
          list.push(feature)
          break
        }
      }
    }
  }

  const progressOpts = {
    statusCallback,
    stopToken,
  }

  let mafs: FilteredVariant[]
  let perRegionMafs: Map<number, FilteredVariant[]> | undefined
  if (perRegionRawFeatures) {
    perRegionMafs = await withProgress(
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
    const allMafs: FilteredVariant[] = []
    for (const regionMafs of perRegionMafs.values()) {
      for (const maf of regionMafs) {
        allMafs.push(maf)
      }
    }
    mafs = allMafs
  } else {
    mafs = await withProgress(
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
  }

  const {
    sampleInfo,
    hasPhased,
    hasSecondaryAlt,
    hasUnphased,
    hasNoCall,
    hasConsequence,
    svTypeColors,
    simplifiedFeatures,
  } = await withProgress(
    { ...progressOpts, label: 'Computing sample info', total: mafs.length },
    report => computeSampleInfo(mafs, genotypesCache, report),
  )
  const hasSvType = Object.keys(svTypeColors).length > 0

  // Resolved after computeSampleInfo because the SV-type preset's color map is
  // built from the types actually present (see makeFeatureColor / svTypeColors).
  const featureColorFn = makeFeatureColor(
    featureColor,
    pluginManager.jexl,
    svTypeColors,
  )

  // For phased mode: expand sources into per-haplotype rows. The client sends
  // layout-ordered sources without HP to avoid a circular sampleInfo dependency;
  // we expand here using the sampleInfo we just computed. Sources from clustering
  // already carry HP and pass through unchanged (see expandSourcesToHaplotypes).
  const effectiveSources =
    renderingMode === 'phased'
      ? expandSourcesToHaplotypes({ sources, sampleInfo })
      : sources

  // Canonical sample order + shared dict for interning genotypes before
  // transfer. sampleInfo keys are the universe of every sampleName any feature's
  // genotype map can reference (built from the same genotypes), so the codes are
  // always alignable. See shared/genotypeCodec.ts.
  const sampleNames = Object.keys(sampleInfo)
  const numSamples = sampleNames.length
  const sampleIndex = new Map(sampleNames.map((name, i) => [name, i]))
  const genotypeDict: string[] = []
  const genotypeDictIndex = new Map<string, number>()

  if (mode === 'regular') {
    const perRegionCellData = await withProgress(
      { ...progressOpts, label: 'Computing variant cells', total: mafs.length },
      report => {
        if (perRegionMafs) {
          // one shared reporter spans all regions: it owns the running counter,
          // so per-region calls accumulate into one global bar with no offset
          // bookkeeping
          const result: Record<number, VariantCellData> = {}
          for (const [regionNum, regionMafs] of perRegionMafs) {
            result[regionNum] = computeVariantCells({
              mafs: regionMafs,
              sources: effectiveSources,
              renderingMode,
              referenceDrawingMode: referenceDrawingMode ?? 'skip',
              featureColor: featureColorFn,
              genotypesCache,
              report,
            })
          }
          return result
        }
        return {
          0: computeVariantCells({
            mafs,
            sources: effectiveSources,
            renderingMode,
            referenceDrawingMode: referenceDrawingMode ?? 'skip',
            featureColor: featureColorFn,
            genotypesCache,
            report,
          }),
        }
      },
    )

    const transferables = []
    const shippedPerRegion: Record<number, ShippedRegionData> = {}
    for (const [k, { featureGenotypeMap, ...rest }] of Object.entries(
      perRegionCellData,
    )) {
      const internedMap: Record<string, VariantFeatureInfo> = {}
      for (const id in featureGenotypeMap) {
        const info = internFeatureGenotypes(
          featureGenotypeMap[id]!,
          sampleIndex,
          numSamples,
          genotypeDict,
          genotypeDictIndex,
        )
        internedMap[id] = info
        transferables.push(info.genotypeCodes.buffer)
      }
      shippedPerRegion[Number(k)] = { ...rest, featureGenotypeMap: internedMap }
      transferables.push(
        rest.cellPositions.buffer,
        rest.cellRowIndices.buffer,
        rest.cellColors.buffer,
        rest.cellShapeTypes.buffer,
        rest.flatbushData,
        rest.cellFeatureIndices.buffer,
      )
    }

    return rpcResult(
      {
        mode: 'regular' as const,
        sampleInfo,
        hasPhased,
        hasSecondaryAlt,
        hasUnphased,
        hasNoCall,
        hasConsequence,
        hasSvType,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        perRegionCellData: shippedPerRegion,
      },
      transferables,
    )
  } else {
    const cellData = await withProgress(
      {
        ...progressOpts,
        label: 'Computing variant matrix cells',
        total: mafs.length,
      },
      report =>
        computeVariantMatrixCells({
          mafs,
          sources: effectiveSources,
          renderingMode,
          featureColor: featureColorFn,
          genotypesCache,
          report,
        }),
    )

    const { featureData, ...restMatrix } = cellData
    const transferables = [
      cellData.cellFeatureIndices.buffer,
      cellData.cellRowIndices.buffer,
      cellData.cellColors.buffer,
    ]
    const internedFeatureData = featureData.map(fd => {
      const info = internFeatureGenotypes(
        fd,
        sampleIndex,
        numSamples,
        genotypeDict,
        genotypeDictIndex,
      )
      transferables.push(info.genotypeCodes.buffer)
      return { ...info, featureId: fd.featureId }
    })

    return rpcResult(
      {
        mode: 'matrix' as const,
        sampleInfo,
        hasPhased,
        hasSecondaryAlt,
        hasUnphased,
        hasNoCall,
        hasConsequence,
        hasSvType,
        svTypeColors,
        simplifiedFeatures,
        genotypeDict,
        sampleNames,
        ...restMatrix,
        featureData: internedFeatureData,
      },
      transferables,
    )
  }
}
