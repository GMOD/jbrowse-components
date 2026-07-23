import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { Region } from '../../util/index.ts'
import type { StatusCallback } from '../../util/progress.ts'
import type { StopToken } from '../../util/stopToken.ts'

export default class CoreGetRegionByteEstimate extends RpcMethodTypeWithRenameRegions {
  name = 'CoreGetRegionByteEstimate'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      regions: Region[]
      stopToken?: StopToken
      headers?: Record<string, string>
      statusCallback?: StatusCallback
      sessionId: string
    },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Adapter does not support retrieving features')
    }
    return dataAdapter.getMultiRegionByteEstimate(regions, deserializedArgs)
  }
}
