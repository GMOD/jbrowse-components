import { isRegionsAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'

export default class CoreGetRegions extends RpcMethodType {
  name = 'CoreGetRegions'

  async execute(
    args: {
      sessionId: string
      adapterConfig: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)
    return isRegionsAdapter(dataAdapter)
      ? dataAdapter.getRegions(deserializedArgs)
      : []
  }
}
