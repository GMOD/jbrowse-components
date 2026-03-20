import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export class WiggleGetMultiRegionQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetMultiRegionQuantitativeStats'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: StopToken
      sessionId: string
      trackInstanceId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const featureAdapter = dataAdapter as BaseFeatureDataAdapter
    return featureAdapter.getMultiRegionQuantitativeStats(
      regions,
      deserializedArgs,
    )
  }
}
