import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { QuantitativeStats } from '@jbrowse/core/util/stats'

export class WiggleGetGlobalQuantitativeStats extends RpcMethodType {
  name = 'WiggleGetGlobalQuantitativeStats'

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
