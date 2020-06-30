import { getAdapter } from '@gmod/jbrowse-core/data_adapters/dataAdapterCache'
import RpcMethodType from '@gmod/jbrowse-core/pluggableElementTypes/RpcMethodType'
import { RenderArgs } from '@gmod/jbrowse-core/rpc/coreRpcMethods'
import { renameRegionsIfNeeded } from '@gmod/jbrowse-core/util'
import { Region } from '@gmod/jbrowse-core/util/types'
import { RemoteAbortSignal } from '@gmod/jbrowse-core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@gmod/jbrowse-core/data_adapters/BaseAdapter'
import {
  FeatureStats,
  blankStats,
  dataAdapterSupportsMultiRegionStats,
  dataAdapterSupportsGlobalStats,
} from '../statsUtil'

export class WiggleGetGlobalStats extends RpcMethodType {
  name = 'WiggleGetGlobalStats'

  async execute(args: {
    adapterConfig: {}
    signal?: RemoteAbortSignal
    headers?: Record<string, string>
    sessionId: string
  }): Promise<FeatureStats> {
    const {
      adapterConfig,
      signal,
      headers,
      sessionId,
    } = await this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsGlobalStats(dataAdapter)
    ) {
      return dataAdapter.getGlobalStats({ signal, headers })
    }
    return blankStats()
  }
}

export class WiggleGetMultiRegionStats extends RpcMethodType {
  name = 'WiggleGetMultiRegionStats'

  async serializeArguments(args: RenderArgs & { signal?: AbortSignal }) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, args)
  }

  async execute(args: {
    adapterConfig: {}
    signal?: RemoteAbortSignal
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    bpPerPx: number
  }) {
    const {
      regions,
      adapterConfig,
      signal,
      bpPerPx,
      headers,
      sessionId,
    } = await this.deserializeArguments(args)
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsMultiRegionStats(dataAdapter)
    ) {
      return dataAdapter.getMultiRegionStats(regions, {
        signal,
        bpPerPx,
        headers,
      })
    }
    return blankStats()
  }
}
