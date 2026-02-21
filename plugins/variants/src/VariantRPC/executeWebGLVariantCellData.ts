import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom, toArray } from 'rxjs'

import { computeVariantCells } from '../MultiWebGLVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../MultiWebGLVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { SampleInfo } from '../shared/types.ts'
import type { MAFFilteredFeature } from '../shared/minorAlleleFrequencyUtils.ts'
import type { GetWebGLCellDataArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

function computeSampleInfo(
  mafs: MAFFilteredFeature[],
  genotypesCache: Map<string, Record<string, string>>,
) {
  const sampleInfo = {} as Record<string, SampleInfo>
  let hasPhased = false

  for (const { feature } of mafs) {
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

export async function executeWebGLVariantCellData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetWebGLCellDataArgs
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

  const rawFeatures = await updateStatus('Loading features', statusCallback, () =>
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
