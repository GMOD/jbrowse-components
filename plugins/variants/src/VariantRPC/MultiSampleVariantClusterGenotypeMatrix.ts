import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { ClusterGenotypeMatrixArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantClusterGenotypeMatrix: {
      args: ClusterGenotypeMatrixArgs
      return: { order: number[]; tree: string }
    }
  }
}

export class MultiSampleVariantClusterGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiSampleVariantClusterGenotypeMatrix'

  async execute(args: ClusterGenotypeMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeClusterGenotypeMatrix } =
      await import('./executeClusterGenotypeMatrix.ts')
    return executeClusterGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
