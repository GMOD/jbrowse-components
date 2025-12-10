import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'

export default class CoreGetRefNames extends RpcMethodType {
  name = 'CoreGetRefNames'

  async execute(
    args: {
      sessionId: string
      stopToken?: string
      adapterConfig: Record<string, unknown>
      sequenceAdapter?: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, adapterConfig, sequenceAdapter } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    if (!isFeatureAdapter(dataAdapter)) {
      return []
    }
    // cache sequenceAdapter config on the adapter if provided (for BAM/CRAM)
    if (sequenceAdapter) {
      const adapter = dataAdapter as { sequenceAdapterConfig?: unknown }
      if (adapter.sequenceAdapterConfig === undefined) {
        adapter.sequenceAdapterConfig = sequenceAdapter
      }
    }
    return dataAdapter.getRefNames(deserializedArgs)
  }
}
