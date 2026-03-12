import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GetCellDataArgs } from './types.ts'

export class MultiSampleVariantGetCellData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantGetCellData'

  async execute(args: GetCellDataArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeVariantCellData } =
      await import('./executeVariantCellData.ts')
    return executeVariantCellData({
      pluginManager: this.pluginManager,
      args: deserializedArgs as unknown as GetCellDataArgs,
    })
  }
}
