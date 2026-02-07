import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GetWebGLCellDataArgs } from './types.ts'

export class MultiVariantGetWebGLCellData extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetWebGLCellData'

  async execute(args: GetWebGLCellDataArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeWebGLVariantCellData } =
      await import('./executeWebGLVariantCellData.ts')
    return executeWebGLVariantCellData({
      pluginManager: this.pluginManager,
      args: deserializedArgs as unknown as GetWebGLCellDataArgs,
    })
  }
}
