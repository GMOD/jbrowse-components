import { getAdapter } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import RpcMethodType from '@gmod/jbrowse-core/pluggableElementTypes/RpcMethodType'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import { RemoteAbortSignal } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  FeatureStats,
  blankStats,
  dataAdapterSupportsWiggleStats,
} from '../statsUtil'

export class WiggleGetGlobalStats extends RpcMethodType {
  async execute(
    pluginManager: PluginManager,
    args: {
      adapterType: string
      adapterConfig: {}
      signal?: RemoteAbortSignal
      sessionId: string
    },
  ): Promise<FeatureStats> {
    const {
      adapterType,
      adapterConfig,
      signal,
      sessionId,
    } = this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      adapterType,
      adapterConfig,
    )
    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsWiggleStats(dataAdapter)
    ) {
      return dataAdapter.getGlobalStats({ signal })
    }
    return blankStats()
  }
}

export class WiggleGetMultiRegionStats extends RpcMethodType {
  async execute(
    pluginManager: PluginManager,
    args: {
      adapterType: string
      adapterConfig: {}
      signal?: RemoteAbortSignal
      sessionId: string
      regions: IRegion[]
      bpPerPx: number
    },
  ) {
    const {
      regions,
      adapterType,
      adapterConfig,
      signal,
      bpPerPx,
      sessionId,
    } = this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      pluginManager,
      sessionId,
      adapterType,
      adapterConfig,
    )

    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsWiggleStats(dataAdapter)
    ) {
      return dataAdapter.getMultiRegionStats(regions, { signal, bpPerPx })
    }
    return blankStats()
  }
}
