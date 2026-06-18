import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus, withProgress } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom, toArray } from 'rxjs'


import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { expandSourcesToHaplotypes } from '../shared/getSources.ts'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { GetCellDataArgs } from './types.ts'
import type { VariantCellData } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import type { MatrixCellData } from '../LinearMultiSampleVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import type { MAFFilteredFeature } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SampleInfo } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ProgressReporter } from '@jbrowse/core/util'

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
  // legend entry) and whether any genotype call is unphased (drives the
  // "Unphased" legend entry in phased mode). Computed here because the
  // simplified features sent to the client no longer carry ALT/genotypes.
  hasSecondaryAlt: boolean
  hasUnphased: boolean
  simplifiedFeatures: SimplifiedVariantFeature[]
}

export type CellDataResult =
  | (CellDataBase & {
      mode: 'regular'
      perRegionCellData: Record<number, VariantCellData>
    })
  | (CellDataBase & MatrixCellData & { mode: 'matrix' })

function computeSampleInfo(
  mafs: MAFFilteredFeature[],
  genotypesCache: Map<string, Record<string, string>>,
  report?: ProgressReporter,
) {
  const sampleInfo: Record<string, SampleInfo> = {}
  let hasPhased = false
  let hasSecondaryAlt = false
  let hasUnphased = false

  let featureIdx = 0
  for (const { feature } of mafs) {
    report?.(featureIdx++)
    const alt = feature.get('ALT') as string[] | undefined
    if (alt && alt.length > 1) {
      hasSecondaryAlt = true
    }
    const callGenotype = feature.get('callGenotype') as Int8Array | undefined
    if (callGenotype) {
      const sampleNames = feature.get('sampleNames') as string[]
      const ploidy = feature.get('ploidy') as number
      const callGenotypePhased = feature.get('callGenotypePhased') as
        | Uint8Array
        | undefined
      for (const [si, sampleName] of sampleNames.entries()) {
        const isPhased = callGenotypePhased
          ? Boolean(callGenotypePhased[si])
          : false
        hasPhased ||= isPhased
        // Multi-allele calls render with a '/' separator when unphased, so a
        // non-haploid unphased sample is a black "Unphased" cell in phased mode.
        hasUnphased ||= ploidy > 1 && !isPhased
        const existing = sampleInfo[sampleName]
        if (existing) {
          if (ploidy > existing.maxPloidy) {
            existing.maxPloidy = ploidy
          }
          existing.isPhased ||= isPhased
        } else {
          sampleInfo[sampleName] = { maxPloidy: ploidy, isPhased }
        }
      }
    } else {
      const featureId = feature.id()
      let samp = genotypesCache.get(featureId)
      if (!samp) {
        samp = feature.get('genotypes') as Record<string, string>
        genotypesCache.set(featureId, samp)
      }

      for (const key in samp) {
        const val = samp[key]!
        const isPhased = val.includes('|')
        hasPhased ||= isPhased
        hasUnphased ||= val.includes('/')
        let ploidy = 1
        for (const char of val) {
          if (char === '|' || char === '/') {
            ploidy++
          }
        }
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
    }
  }

  const simplifiedFeatures = mafs.map(({ feature }) => ({
    id: feature.id(),
    data: {
      start: feature.get('start'),
      end: feature.get('end'),
      refName: feature.get('refName'),
      name: feature.get('name'),
    },
  }))

  return {
    sampleInfo,
    hasPhased,
    hasSecondaryAlt,
    hasUnphased,
    simplifiedFeatures,
  }
}

/**
 * Drive a determinate `report` across a per-region map, advancing a running
 * offset so the progress bar reflects features completed across all regions.
 * `fn` receives a region-local reporter that maps 0-based region indices back
 * onto the global feature count.
 */
function forEachRegionWithProgress<T>(
  perRegion: Iterable<[number, T[]]>,
  report: ProgressReporter,
  fn: (regionNum: number, items: T[], report: ProgressReporter) => void,
) {
  let base = 0
  for (const [regionNum, items] of perRegion) {
    const offset = base
    fn(regionNum, items, cur => {
      report(offset + cur)
    })
    base += items.length
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
    minorAlleleFrequencyFilter,
    filters,
    regions,
    adapterConfig,
    sessionId,
    statusCallback,
    stopToken,
    displayedRegionIndices,
  } = args

  const regionLookup = displayedRegionIndices
    ? regions.map((r, i) => ({
        refName: r.refName,
        start: r.start,
        end: r.end,
        displayedRegionIndex: displayedRegionIndices[i]!,
      }))
    : undefined

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const adapter = dataAdapter as BaseFeatureDataAdapter

  const rawFeatures = await updateStatus(
    'Loading features',
    statusCallback,
    () =>
      firstValueFrom(
        adapter
          .getFeaturesInMultipleRegions(regions, {
            ...args,
            onProgress: statusCallback,
          })
          .pipe(toArray()),
      ),
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

  let mafs: MAFFilteredFeature[]
  let perRegionMafs: Map<number, MAFFilteredFeature[]> | undefined
  if (perRegionRawFeatures) {
    perRegionMafs = await withProgress(
      { ...progressOpts, label: 'Filtering variants', total: rawFeatures.length },
      report => {
        const result = new Map<number, MAFFilteredFeature[]>()
        forEachRegionWithProgress(
          perRegionRawFeatures,
          report,
          (regionNum, features, report) => {
            result.set(
              regionNum,
              getFeaturesThatPassMinorAlleleFrequencyFilter({
                features,
                minorAlleleFrequencyFilter,
                filterChain: filters,
                genotypesCache,
                report,
              }),
            )
          },
        )
        return result
      },
    )
    const allMafs: MAFFilteredFeature[] = []
    for (const regionMafs of perRegionMafs.values()) {
      for (const maf of regionMafs) {
        allMafs.push(maf)
      }
    }
    mafs = allMafs
  } else {
    mafs = await withProgress(
      { ...progressOpts, label: 'Filtering variants', total: rawFeatures.length },
      report =>
        getFeaturesThatPassMinorAlleleFrequencyFilter({
          features: rawFeatures,
          minorAlleleFrequencyFilter,
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
    simplifiedFeatures,
  } = await withProgress(
    { ...progressOpts, label: 'Computing sample info', total: mafs.length },
    report => computeSampleInfo(mafs, genotypesCache, report),
  )

  // For phased mode: expand sources into per-haplotype rows. The client sends
  // layout-ordered sources without HP to avoid a circular sampleInfo dependency;
  // we expand here using the sampleInfo we just computed. Sources from clustering
  // already carry HP and pass through unchanged (see expandSourcesToHaplotypes).
  const effectiveSources =
    renderingMode === 'phased'
      ? expandSourcesToHaplotypes({ sources, sampleInfo })
      : sources

  if (mode === 'regular') {
    const perRegionCellData = await withProgress(
      { ...progressOpts, label: 'Computing variant cells', total: mafs.length },
      report => {
        if (perRegionMafs) {
          const result: Record<number, VariantCellData> = {}
          forEachRegionWithProgress(
            perRegionMafs,
            report,
            (regionNum, regionMafs, report) => {
              result[regionNum] = computeVariantCells({
                mafs: regionMafs,
                sources: effectiveSources,
                renderingMode,
                referenceDrawingMode: referenceDrawingMode ?? 'skip',
                genotypesCache,
                report,
              })
            },
          )
          return result
        }
        return {
          0: computeVariantCells({
            mafs,
            sources: effectiveSources,
            renderingMode,
            referenceDrawingMode: referenceDrawingMode ?? 'skip',
            genotypesCache,
            report,
          }),
        }
      },
    )

    const transferables = []
    for (const cellData of Object.values(perRegionCellData)) {
      transferables.push(
        cellData.cellPositions.buffer,
        cellData.cellRowIndices.buffer,
        cellData.cellColors.buffer,
        cellData.cellShapeTypes.buffer,
        cellData.flatbushData,
        cellData.flatbushGenomicStarts.buffer,
        cellData.flatbushGenomicEnds.buffer,
        cellData.flatbushFeatureIndices.buffer,
      )
    }

    return rpcResult(
      {
        mode: 'regular' as const,
        sampleInfo,
        hasPhased,
        hasSecondaryAlt,
        hasUnphased,
        simplifiedFeatures,
        perRegionCellData,
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
          genotypesCache,
          report,
        }),
    )

    return rpcResult(
      {
        mode: 'matrix' as const,
        sampleInfo,
        hasPhased,
        hasSecondaryAlt,
        hasUnphased,
        simplifiedFeatures,
        ...cellData,
      },
      [
        cellData.cellFeatureIndices.buffer,
        cellData.cellRowIndices.buffer,
        cellData.cellColors.buffer,
      ],
    )
  }
}
