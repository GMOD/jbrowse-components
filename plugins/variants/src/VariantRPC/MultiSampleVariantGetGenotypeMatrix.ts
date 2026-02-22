import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { getGenotypeMatrix } from './getGenotypeMatrix.ts'

import type { GetGenotypeMatrixArgs } from './types.ts'

export class MultiSampleVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantGetGenotypeMatrix'

  async execute(args: GetGenotypeMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const stopTokenCheck = createStopTokenChecker(deserializedArgs.stopToken)
    return getGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: { ...deserializedArgs, stopTokenCheck },
    })
  }
}
