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

export type CellDataResult =
  | (CellDataBase & VariantCellData & { mode: 'regular' })
  | (CellDataBase & MatrixCellData & { mode: 'matrix' })

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
        const name = sampleName
        const isPhased = callGenotypePhased
          ? Boolean(callGenotypePhased[si])
          : false
        hasPhased ||= isPhased
        const existing = sampleInfo[name]
        if (existing) {
          if (ploidy > existing.maxPloidy) {
            existing.maxPloidy = ploidy
          }
          existing.isPhased ||= isPhased
        } else {
          sampleInfo[name] = { maxPloidy: ploidy, isPhased }
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
        if (isPhased) {
          for (const char of val) {
            if (char === '|') {
              ploidy++
            }
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
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const rawFeatures = await updateStatus(
    'Loading features',
    statusCallback,
    () =>
      firstValueFrom(
        (dataAdapter as BaseFeatureDataAdapter)
          .getFeaturesInMultipleRegions(regions, args)
          .pipe(toArray()),
      ),
  )

  const genotypesCache = new Map<string, Record<string, string>>()

  const mafs = await updateStatus('Filtering variants', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      features: rawFeatures,
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      genotypesCache,
    }),
  )

  const { sampleInfo, hasPhased, simplifiedFeatures } = await updateStatus(
    'Computing sample info',
    statusCallback,
    () => computeSampleInfo(mafs, genotypesCache),
  )

  if (mode === 'regular') {
    const cellData = await updateStatus(
      'Computing variant cells',
      statusCallback,
      () =>
        computeVariantCells({
          mafs,
          sources,
          renderingMode,
          referenceDrawingMode: referenceDrawingMode ?? 'skip',
          genotypesCache,
        }),
    )

    return rpcResult(
      {
        mode: 'regular' as const,
        sampleInfo,
        hasPhased,
        simplifiedFeatures,
        ...cellData,
      },
      [
        cellData.cellPositions.buffer,
        cellData.cellRowIndices.buffer,
        cellData.cellColors.buffer,
        cellData.cellShapeTypes.buffer,
      ] as ArrayBuffer[],
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
