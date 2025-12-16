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

    // Set sequenceAdapterConfig on the adapter as fallback for standalone
    // BAM/CRAM tracks that don't have sequenceAdapter in their config
    if (sequenceAdapter) {
      const adapter = dataAdapter as { sequenceAdapterConfig?: unknown }
      if (adapter.sequenceAdapterConfig === undefined) {
        adapter.sequenceAdapterConfig = sequenceAdapter
      }

      // Pre-warm the adapter cache for subadapters (e.g., SNPCoverageAdapter
      // wraps CramAdapter/BamAdapter) with sequenceAdapter included in the config.
      // This ensures the cache key matches what SNPCoverageAdapter.configure() uses.
      const subadapterConfigBase = adapterConfig.subadapter as
        | Record<string, unknown>
        | undefined
      if (subadapterConfigBase) {
        const subadapterConfig = { ...subadapterConfigBase, sequenceAdapter }
        await getAdapter(pm, sessionId, subadapterConfig)
      }
    }

    return dataAdapter.getRefNames(deserializedArgs)
  }
}
