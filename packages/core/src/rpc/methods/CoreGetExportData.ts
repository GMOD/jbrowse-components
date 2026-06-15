import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import type { Region } from '../../util/index.ts'

export default class CoreGetExportData extends RpcMethodTypeWithRenameRegions {
  name = 'CoreGetExportData'

  async execute(
    args: {
      sessionId: string
      regions: Region[]
      adapterConfig: Record<string, unknown>
      formatType: string
      opts?: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const { sessionId, adapterConfig, regions, formatType, opts } =
      await this.deserializeArguments(args, rpcDriver)

    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    return (await dataAdapter.getExportData(regions, formatType, opts)) ?? ''
  }
}
