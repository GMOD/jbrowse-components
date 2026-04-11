import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { WiggleGetGlobalQuantitativeStatsArgs } from './types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RectifiedQuantitativeStats } from '@jbrowse/core/util/stats'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    WiggleGetGlobalQuantitativeStats: {
      args: WiggleGetGlobalQuantitativeStatsArgs
      return: Partial<RectifiedQuantitativeStats> | undefined
    }
  }
}

export class WiggleGetGlobalQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetGlobalQuantitativeStats'

  async execute(
    args: WiggleGetGlobalQuantitativeStatsArgs,
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
