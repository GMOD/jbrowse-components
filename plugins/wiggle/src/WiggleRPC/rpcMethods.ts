import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { renameRegionsIfNeeded } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { FeatureStats } from '@jbrowse/core/util/stats'

export class WiggleGetGlobalStats extends RpcMethodType {
  name = 'WiggleGetGlobalStats'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deserializeArguments(args: any, rpcDriverClassName: string) {
    const l = await super.deserializeArguments(args, rpcDriverClassName)
    return {
      ...l,
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
          })
        : undefined,
    }
  }

  async execute(
    args: {
      adapterConfig: {}
      signal?: RemoteAbortSignal
      headers?: Record<string, string>
      sessionId: string
    },
    rpcDriverClassName: string,
  ): Promise<FeatureStats> {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      // @ts-ignore
      if (dataAdapter.capabilities.includes('hasGlobalStats')) {
        // @ts-ignore
        return dataAdapter.getGlobalStats(deserializedArgs)
      }
      throw new Error('Data adapter does not support global stats')
    }
    throw new Error('Data adapter not found')
  }
}

export class WiggleGetMultiRegionStats extends RpcMethodType {
  name = 'WiggleGetMultiRegionStats'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deserializeArguments(args: any, rpcDriverClassName: string) {
    const l = await super.deserializeArguments(args, rpcDriverClassName)
    return {
      ...l,
      filters: args.filters
        ? new SerializableFilterChain({
            filters: args.filters,
          })
        : undefined,
    }
  }

  async serializeArguments(
    args: RenderArgs & { signal?: AbortSignal; statusCallback?: Function },
  ) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters && args.filters.toJSON().filters,
    })
  }

  async execute(
    args: {
      adapterConfig: {}
      signal?: RemoteAbortSignal
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getMultiRegionStats(regions, deserializedArgs)
    }
    throw new Error('Data adapter not found')
  }
}
