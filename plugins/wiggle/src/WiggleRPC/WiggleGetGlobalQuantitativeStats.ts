import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { RemoteAbortSignal } from '@jbrowse/core/rpc/remoteAbortSignals'
import { QuantitativeStats } from '@jbrowse/core/util/stats'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

export class WiggleGetGlobalQuantitativeStats extends RpcMethodType {
  name = 'WiggleGetGlobalQuantitativeStats'

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
      adapterConfig: AnyConfigurationModel
      signal?: RemoteAbortSignal
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
