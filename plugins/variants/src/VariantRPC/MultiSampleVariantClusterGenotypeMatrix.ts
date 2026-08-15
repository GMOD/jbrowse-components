import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { ClusterGenotypeMatrixArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantClusterGenotypeMatrix: {
      args: ClusterGenotypeMatrixArgs
      return: { order: number[]; tree: string }
    }
  }
}

export class MultiSampleVariantClusterGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantClusterGenotypeMatrix'> {
  name = 'MultiSampleVariantClusterGenotypeMatrix' as const

  async execute(
    args: RpcExecuteArgs<'MultiSampleVariantClusterGenotypeMatrix'>,
    rpcDriverClassName: string,
  ) {
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
