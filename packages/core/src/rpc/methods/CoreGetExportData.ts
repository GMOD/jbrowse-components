import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'
import { renameRegionsIfNeeded } from '../../util/index.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { Region } from '../../util/index.ts'

export default class CoreGetExportData extends RpcMethodType {
  name = 'CoreGetExportData'

  async serializeArguments(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: any
    },
    rpcDriver: string,
  ) {
    const { rootModel } = this.pluginManager
    const assemblyManager = rootModel!.session!.assemblyManager
    const renamedArgs = await renameRegionsIfNeeded(assemblyManager, args)
    return super.serializeArguments(renamedArgs, rpcDriver)
  }

  async execute(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: any
    },
    rpcDriver: string,
  ) {
    const { sessionId, adapterConfig, regions, formatType, opts } =
      await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const result = await dataAdapter.getExportData(regions, formatType, opts)
    return result || ''
  }
}
