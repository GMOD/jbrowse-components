import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { buildGenotypeMatrix } from './buildGenotypeMatrix.ts'

import type { GetGenotypeMatrixArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetGenotypeMatrix: {
      args: GetGenotypeMatrixArgs
      // NaN marks a no-call; see genotypeMatrixEncoding.ts
      return: Record<string, Float32Array>
    }
  }
}

export class MultiSampleVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantGetGenotypeMatrix'

  async execute(args: GetGenotypeMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const stopTokenCheck = createStopTokenChecker(deserializedArgs.stopToken)
    return buildGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: { ...deserializedArgs, stopTokenCheck },
    })
  }
}
