import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import type { GetGenotypeMatrixArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetGenotypeMatrix: {
      args: GetGenotypeMatrixArgs
      // NaN marks a no-call; see genotypeMatrixEncoding.ts. A Map because the
      // row order is what the cluster order indexes into (see ClusterMatrix).
      return: Map<string, Float32Array>
    }
  }
}

export class MultiSampleVariantGetGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantGetGenotypeMatrix'> {
  name = 'MultiSampleVariantGetGenotypeMatrix' as const

  async execute(args: GetGenotypeMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const stopTokenCheck = createStopTokenChecker(deserializedArgs.stopToken)
    const { buildGenotypeMatrix } = await import('./buildGenotypeMatrix.ts')
    return buildGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: { ...deserializedArgs, stopTokenCheck },
    })
  }
}
