import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Region } from '@jbrowse/core/util'

export class WiggleGetMultiRegionQuantitativeStats extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'WiggleGetMultiRegionQuantitativeStats'

  async execute(
    args: {
      adapterConfig: Record<string, unknown>
      stopToken?: string
      sessionId: string
      headers?: Record<string, string>
      regions: Region[]
      staticBlocks?: Region[]
      bpPerPx: number
    },
    rpcDriverClassName: string,
  ) {
    const pm = this.pluginManager
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { regions, staticBlocks, adapterConfig, sessionId } = deserializedArgs
    const { dataAdapter } = await getAdapter(pm, sessionId, adapterConfig)

    // @ts-expect-error
    return dataAdapter.getMultiRegionQuantitativeStats(regions, {
      ...deserializedArgs,
      staticBlocks,
    })
  }
}
