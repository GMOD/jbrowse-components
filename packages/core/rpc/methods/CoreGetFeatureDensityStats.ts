import { isFeatureAdapter } from '../../data_adapters/BaseAdapter'
import { getAdapter } from '../../data_adapters/dataAdapterCache'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType'
import { renameRegionsIfNeeded } from '../../util'
import type { RenderArgs } from './util'
import type { Region } from '../../util'

export default class CoreGetFeatureDensityStats extends RpcMethodType {
  name = 'CoreGetFeatureDensityStats'

  async serializeArguments(
    args: RenderArgs & {
      stopToken?: string
      statusCallback?: (arg: string) => void
    },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, {
      ...args,
      filters: args.filters?.toJSON().filters,
    })

    return super.serializeArguments(renamedArgs, rpcDriver)
  }

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      regions: Region[]
      stopToken?: string
      headers?: Record<string, string>
      sessionId: string
    },
    rpcDriver: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Adapter does not support retrieving features')
    }
    return dataAdapter.getMultiRegionFeatureDensityStats(
      regions,
      deserializedArgs,
    )
  }
}
