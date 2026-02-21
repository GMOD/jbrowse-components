import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom, toArray } from 'rxjs'

import { computeVariantCells } from '../MultiWebGLVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../MultiWebGLVariantMatrixDisplay/components/computeVariantMatrixCells.ts'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'

import type { SampleInfo } from '../shared/types.ts'
import type { GetWebGLCellDataArgs } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

function computeSampleInfo(
  rawFeatures: Feature[],
  minorAlleleFrequencyFilter: number,
  lengthCutoffFilter: number,
) {
  const genotypesCache = new Map<string, Record<string, string>>()
  const sampleInfo = {} as Record<string, SampleInfo>
  let hasPhased = false

  const features = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    features: rawFeatures,
    genotypesCache,
  })

  for (const { feature } of features) {
    const featureId = feature.id()
    let samp = genotypesCache.get(featureId)
    if (!samp) {
      samp = feature.get('genotypes') as Record<string, string>
      genotypesCache.set(featureId, samp)
    }

    for (const [key, val] of Object.entries(samp)) {
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
      sampleInfo[key] = {
        maxPloidy: Math.max(existing?.maxPloidy ?? 0, ploidy),
        isPhased: existing?.isPhased || isPhased,
      }
    }
  }

  const simplifiedFeatures = features.map(({ feature }) => ({
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
  } = args

  const { dataAdapter } = await getAdapter(
    pluginManager,
    sessionId,
    adapterConfig,
  )

  const rawFeatures = await firstValueFrom(
    (dataAdapter as BaseFeatureDataAdapter)
      .getFeaturesInMultipleRegions(regions, args)
      .pipe(toArray()),
  )

  const { sampleInfo, hasPhased, simplifiedFeatures } = computeSampleInfo(
    rawFeatures,
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
  )

  if (mode === 'regular') {
    const cellData = computeVariantCells({
      features: rawFeatures,
      sources,
      renderingMode,
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      referenceDrawingMode: referenceDrawingMode ?? 'skip',
    })

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
    const cellData = computeVariantMatrixCells({
      features: rawFeatures,
      sources,
      renderingMode,
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
    })

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
