import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'

import { RemoteAbortSignal } from '../remoteAbortSignals'
import { isRegionsAdapter } from '../../data_adapters/BaseAdapter'

export default class CoreGetRegions extends RpcMethodType {
  name = 'CoreGetRegions'

  async execute(
    args: {
      sessionId: string
      signal: RemoteAbortSignal
      adapterConfig: {}
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
