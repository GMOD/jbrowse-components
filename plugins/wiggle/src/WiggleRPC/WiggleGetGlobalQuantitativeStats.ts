import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { QuantitativeStats } from '@jbrowse/core/util/stats'

export class WiggleGetGlobalQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetGlobalQuantitativeStats'

  async execute(
    args: {
      adapterConfig: AnyConfigurationModel
      stopToken?: string
      headers?: Record<string, string>
      sessionId: string
    },
    rpcDriverClassName: string,
  ): Promise<QuantitativeStats> {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    // @ts-expect-error
    return dataAdapter.getGlobalStats(deserializedArgs)
  }
}
