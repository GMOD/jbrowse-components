import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { getLDMatrix } from './getLDMatrix.ts'

import type { GetLDMatrixArgs } from './types.ts'

export class MultiVariantGetLDMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetLDMatrix'

  async execute(args: GetLDMatrixArgs, rpcDriverClassName: string) {
    return getLDMatrix({
      pluginManager: this.pluginManager,
      args: await this.deserializeArguments(args, rpcDriverClassName),
    })
  }
}
