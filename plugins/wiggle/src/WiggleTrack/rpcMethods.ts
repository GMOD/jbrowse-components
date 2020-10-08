import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
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
    const deserializedArgs = await this.deserializeArguments(args)
    const { adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsGlobalStats(dataAdapter)
    ) {
      return dataAdapter.getGlobalStats(deserializedArgs)
    }
    return blankStats()
  }
}

export class WiggleGetMultiRegionStats extends RpcMethodType {
  name = 'WiggleGetMultiRegionStats'

  async serializeArguments(
    args: RenderArgs & { signal?: AbortSignal; statusCallback?: Function },
  ) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    // @ts-ignore
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
    const deserializedArgs = await this.deserializeArguments(args)
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    if (
      dataAdapter instanceof BaseFeatureDataAdapter &&
      dataAdapterSupportsMultiRegionStats(dataAdapter)
    ) {
      return dataAdapter.getMultiRegionStats(regions, deserializedArgs)
    }
    return blankStats()
  }
}
