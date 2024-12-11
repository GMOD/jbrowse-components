import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'

export default class CoreGetMetadata extends RpcMethodType {
  name = 'CoreGetMetadata'

  async execute(
    args: {
      sessionId: string
      stopToken?: string
      adapterConfig: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getMetadata(deserializedArgs)
      : null
  }
}
