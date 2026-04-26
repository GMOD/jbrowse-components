import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../../util/index.ts'

import type { Region } from '../../util/index.ts'
import type { StopToken } from '../../util/stopToken.ts'
import type { RpcArgs } from '../RpcRegistry.ts'

export default class CoreGetFeatureDensityStats extends RpcMethodType {
  name = 'CoreGetFeatureDensityStats'

  async serializeArguments(
    args: RpcArgs<'CoreGetFeatureDensityStats'> & { sessionId: string },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(renamedArgs, rpcDriver)
  }

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      regions: Region[]
      stopToken?: StopToken
      headers?: Record<string, string>
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
    return dataAdapter.getMultiRegionFeatureDensityStats(
      regions,
      deserializedArgs,
    )
  }
}
