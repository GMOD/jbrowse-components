import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { RenderArgs } from '@jbrowse/core/rpc/coreRpcMethods'
import { renameRegionsIfNeeded, Region } from '@jbrowse/core/util'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

export class MultiWiggleGetSources extends RpcMethodType {
  name = 'MultiWiggleGetSources'

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
      adapterConfig: AnyConfigurationModel
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

    // @ts-expect-error
    return dataAdapter.getSources(regions, deserializedArgs)
  }
}
