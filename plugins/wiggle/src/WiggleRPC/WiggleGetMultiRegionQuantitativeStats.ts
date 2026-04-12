import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { WiggleGetMultiRegionQuantitativeStatsArgs } from './types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RectifiedQuantitativeStats } from '@jbrowse/core/util/stats'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    WiggleGetMultiRegionQuantitativeStats: {
      args: WiggleGetMultiRegionQuantitativeStatsArgs
      return: RectifiedQuantitativeStats
    }
  }
}

export class WiggleGetMultiRegionQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetMultiRegionQuantitativeStats'

  async execute(
    args: WiggleGetMultiRegionQuantitativeStatsArgs,
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
