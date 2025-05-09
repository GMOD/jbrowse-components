import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { getGenotypeMatrix } from './getGenotypeMatrix'

import type { GetGenotypeMatrixArgs } from './types'

export class MultiVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantGetGenotypeMatrix'

  async execute(args: GetGenotypeMatrixArgs, rpcDriverClassName: string) {
    return getGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: await this.deserializeArguments(args, rpcDriverClassName),
    })
  }
}
