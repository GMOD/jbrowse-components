import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom, toArray } from 'rxjs'

import { computeVariantCells } from '../MultiWebGLVariantDisplay/components/computeVariantCells.ts'
import { computeVariantMatrixCells } from '../MultiWebGLVariantMatrixDisplay/components/computeVariantMatrixCells.ts'

import type { GetWebGLCellDataArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

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
