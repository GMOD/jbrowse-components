import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

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

    // Set sequenceAdapterConfig on the adapter for BAM/CRAM adapters that need
    // reference sequence data. Wrapper adapters like SNPCoverageAdapter override
    // setSequenceAdapterConfig to propagate to their subadapters.
    if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }

    return dataAdapter.getRefNames(deserializedArgs)
  }
}
