import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { Region, renameRegionsIfNeeded } from '@jbrowse/core/util'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export class WiggleGetMultiRegionQuantitativeStats extends RpcMethodType {
  name = 'WiggleGetMultiRegionQuantitativeStats'

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
    args: RenderArgs & {
      signal?: AbortSignal
      statusCallback?: (arg: string) => void
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters?.toJSON().filters,
    })

    return super.serializeArguments(renamedArgs, rpcDriverClassName)
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
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getMultiRegionQuantitativeStats(
        regions,
        deserializedArgs,
      )
    }
    throw new Error('Data adapter not found')
  }
}
