import { getFeatureAdapter } from '../../data_adapters/getFeatureAdapter.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { StatusCallback } from '../../util/progress.ts'
import type { StopToken } from '../../util/stopToken.ts'

export default class CoreGetRefNames extends RpcMethodType {
  name = 'CoreGetRefNames'

  async execute(
    args: {
      sessionId: string
      stopToken?: StopToken
      statusCallback?: StatusCallback
      adapterConfig: Record<string, unknown>
      assemblyName?: string
      sequenceAdapter?: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, adapterConfig, sequenceAdapter } = deserializedArgs
    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
      sequenceAdapter,
    })
    return dataAdapter ? dataAdapter.getRefNames(deserializedArgs) : []
  }
}
