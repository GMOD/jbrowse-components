import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GetScoreMatrixArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleClusterScoreMatrix: {
      args: GetScoreMatrixArgs
      return: { order: number[]; tree: string }
    }
  }
}

export class MultiWiggleClusterScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiWiggleClusterScoreMatrix'> {
  name = 'MultiWiggleClusterScoreMatrix' as const

  async execute(args: RpcExecuteArgs<'MultiWiggleClusterScoreMatrix'>) {
    const { executeClusterScoreMatrix } =
      await import('./executeClusterScoreMatrix.ts')
    return executeClusterScoreMatrix({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
