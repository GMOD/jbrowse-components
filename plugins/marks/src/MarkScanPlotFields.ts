import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import { scanPlotFields } from './LinearMarkDisplay/scanPlotFields.ts'
import { listsSources } from './MarkRowsRPC/MarkGetRowSources.ts'

import type { PlotFields } from './LinearMarkDisplay/scanPlotFields.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util/types/data'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MarkScanPlotFields: {
      args: { adapterConfig: Record<string, unknown>; regions: Region[] }
      return: PlotFields
    }
  }
}

/**
 * The fields the Plot field dialog offers, scanned where the features are
 * read: the answer is a few names, where the features themselves would cross
 * the wire whole.
 */
export default class MarkScanPlotFields extends RpcMethodTypeWithRenameRegions<'MarkScanPlotFields'> {
  name = 'MarkScanPlotFields' as const

  async execute(args: RpcExecuteArgs<'MarkScanPlotFields'>) {
    const { sessionId, adapterConfig, regions, signal, statusCallback } = args
    const adapter = await getFeatureAdapterOrThrow({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })
    const features = await adapter.getFeaturesInMultipleRegionsArray(regions, {
      signal,
      statusCallback,
    })
    return scanPlotFields(features, { multiSource: listsSources(adapter) })
  }
}
