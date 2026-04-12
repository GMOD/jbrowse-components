import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom, toArray } from 'rxjs'

import { computeVariantCells } from '../MultiVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../MultiVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { GetCellDataArgs } from './types.ts'
import type { VariantCellData } from '../MultiVariantDisplay/components/computeVariantCells.ts'
import type { MatrixCellData } from '../MultiVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import type { MAFFilteredFeature } from '../shared/minorAlleleFrequencyUtils.ts'
import type { SampleInfo } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

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
  simplifiedFeatures: SimplifiedVariantFeature[]
}

export interface RegionTooLargeResult {
  regionTooLarge: true
  bytes: number
  fetchSizeLimit: number
}

export type CellDataResult =
  | (CellDataBase & {
      mode: 'regular'
      perRegionCellData: Record<number, VariantCellData>
    })
  | (CellDataBase & MatrixCellData & { mode: 'matrix' })
  | RegionTooLargeResult

function computeSampleInfo(
  mafs: MAFFilteredFeature[],
  genotypesCache: Map<string, Record<string, string>>,
) {
  const sampleInfo = {} as Record<string, SampleInfo>
  let hasPhased = false

  for (const { feature } of mafs) {
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

  return { sampleInfo, hasPhased, simplifiedFeatures }
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
    lengthCutoffFilter,
    regions,
    adapterConfig,
    sessionId,
    statusCallback,
    regionNumbers,
    byteSizeLimit,
  } = args

  const regionLookup = regionNumbers
    ? regions.map((r, i) => ({
        refName: r.refName,
        start: r.start,
        end: r.end,
        regionNumber: regionNumbers[i]!,
      }))
    : undefined

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const adapter = dataAdapter as BaseFeatureDataAdapter
  if (byteSizeLimit) {
    const stats = await adapter.getMultiRegionFeatureDensityStats(regions, args)
    if (stats.bytes && stats.bytes > byteSizeLimit) {
      return {
        regionTooLarge: true as const,
        bytes: stats.bytes,
        fetchSizeLimit: stats.fetchSizeLimit ?? byteSizeLimit,
      }
    }
  }

  const rawFeatures = await updateStatus(
    'Loading features',
    statusCallback,
    () =>
      firstValueFrom(
        adapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
  )

  const genotypesCache = new Map<string, Record<string, string>>()

  // Group rawFeatures by region using a sorted pointer advance (O(N+R)).
  // Features from adapters are position-sorted; regions are also sorted.
  // This avoids any per-feature lookup when computing per-region cells.
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
    const ptrs = new Map<string, number>()
    for (const feature of rawFeatures) {
      const refName = feature.get('refName') as string
      const start = feature.get('start') as number
      const candidates = regionsByRefName.get(refName)
      if (!candidates) {
        continue
      }
      let p = ptrs.get(refName) ?? 0
      while (p < candidates.length && candidates[p]!.end <= start) {
        p++
      }
      ptrs.set(refName, p)
      const region = candidates[p]
      if (!region || start < region.start) {
        continue
      }
      let list = perRegionRawFeatures.get(region.regionNumber)
      if (!list) {
        list = []
        perRegionRawFeatures.set(region.regionNumber, list)
      }
      list.push(feature)
    }
  }

  let mafs: MAFFilteredFeature[]
  let perRegionMafs: Map<number, MAFFilteredFeature[]> | undefined
  if (perRegionRawFeatures) {
    perRegionMafs = new Map()
    const allMafs: MAFFilteredFeature[] = []
    for (const [regionNum, features] of perRegionRawFeatures) {
      const regionMafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
        features,
        minorAlleleFrequencyFilter,
        lengthCutoffFilter,
        genotypesCache,
      })
      perRegionMafs.set(regionNum, regionMafs)
      allMafs.push(...regionMafs)
    }
    mafs = allMafs
  } else {
    mafs = await updateStatus('Filtering variants', statusCallback, () =>
      getFeaturesThatPassMinorAlleleFrequencyFilter({
        features: rawFeatures,
        minorAlleleFrequencyFilter,
        lengthCutoffFilter,
        genotypesCache,
      }),
    )
  }

  const { sampleInfo, hasPhased, simplifiedFeatures } = await updateStatus(
    'Computing sample info',
    statusCallback,
    () => computeSampleInfo(mafs, genotypesCache),
  )

  if (mode === 'regular') {
    const perRegionCellData = await updateStatus(
      'Computing variant cells',
      statusCallback,
      () => {
        if (perRegionMafs) {
          const result = {} as Record<number, VariantCellData>
          for (const [regionNum, regionMafs] of perRegionMafs) {
            result[regionNum] = computeVariantCells({
              mafs: regionMafs,
              sources,
              renderingMode,
              referenceDrawingMode: referenceDrawingMode ?? 'skip',
              genotypesCache,
            })
          }
          return result
        }
        return {
          0: computeVariantCells({
            mafs,
            sources,
            renderingMode,
            referenceDrawingMode: referenceDrawingMode ?? 'skip',
            genotypesCache,
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
      )
    }

    return rpcResult(
      {
        mode: 'regular' as const,
        sampleInfo,
        hasPhased,
        simplifiedFeatures,
        perRegionCellData,
      },
      transferables,
    )
  } else {
    const cellData = await updateStatus(
      'Computing variant matrix cells',
      statusCallback,
      () =>
        computeVariantMatrixCells({
          mafs,
          sources,
          renderingMode,
          genotypesCache,
        }),
    )

    return rpcResult(
      {
        mode: 'matrix' as const,
        sampleInfo,
        hasPhased,
        simplifiedFeatures,
        ...cellData,
      },
      [
        cellData.cellFeatureIndices.buffer,
        cellData.cellRowIndices.buffer,
        cellData.cellColors.buffer,
      ] as ArrayBuffer[],
    )
  }
}
