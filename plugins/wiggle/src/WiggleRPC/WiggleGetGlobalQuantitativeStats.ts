import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export class WiggleGetGlobalQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetGlobalQuantitativeStats'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: StopToken
      headers?: Record<string, string>
      sessionId: string
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    const featureAdapter = dataAdapter as BaseFeatureDataAdapter
    return featureAdapter.getGlobalStats(deserializedArgs)
  }
}
