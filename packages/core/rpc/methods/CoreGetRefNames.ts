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
      console.log('CoreGetRefNames: sequenceAdapter provided, adapter.sequenceAdapterConfig was=', adapter.sequenceAdapterConfig ? 'present' : 'undefined')
      if (adapter.sequenceAdapterConfig === undefined) {
        console.log('CoreGetRefNames: setting sequenceAdapterConfig on adapter')
        adapter.sequenceAdapterConfig = sequenceAdapter
      }
    } else {
      console.log('CoreGetRefNames: no sequenceAdapter provided')
    }
    return dataAdapter.getRefNames(deserializedArgs)
  }
}
