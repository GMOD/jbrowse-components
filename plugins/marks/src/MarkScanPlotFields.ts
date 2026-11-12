import { listsRowSources } from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { isAbortException } from '@jbrowse/core/util/aborting'

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
 * How many files the adapter lists rows for, none where its listing fails, as
 * the display's own listing read falls back to the features.
 */
async function listedSourceCount(adapter: object, signal?: AbortSignal) {
  try {
    const listing = listsRowSources(adapter)
      ? await adapter.listRowSources({ signal })
      : undefined
    return listing?.field === 'source' ? listing.sources.length : 0
  } catch (e) {
    if (isAbortException(e)) {
      throw e
    } else {
      return 0
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
    const { regions, signal, statusCallback } = args
    const adapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    const features = await adapter.getFeaturesInMultipleRegionsArray(regions, {
      signal,
      statusCallback,
    })
    const { scanPlotFields } =
      await import('./LinearMarkDisplay/scanPlotFields.ts')
    return scanPlotFields(features, {
      listedSources: await listedSourceCount(adapter, signal),
    })
  }
}
