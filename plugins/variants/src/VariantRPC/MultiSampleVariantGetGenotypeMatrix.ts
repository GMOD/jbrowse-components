import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import type { GetGenotypeMatrixArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

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

  async execute(args: RpcExecuteArgs<'MultiSampleVariantGetGenotypeMatrix'>) {
    const stopTokenCheck = createStopTokenChecker(args.stopToken)
    const { buildGenotypeMatrix } = await import('./buildGenotypeMatrix.ts')
    return buildGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: { ...args, stopTokenCheck },
    })
  }
}
