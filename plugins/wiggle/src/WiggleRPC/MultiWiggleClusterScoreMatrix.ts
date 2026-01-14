import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { GetScoreMatrixArgs } from './types.ts'

export class MultiWiggleClusterScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleClusterScoreMatrix'

  async execute(args: GetScoreMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeClusterScoreMatrix } =
      await import('./executeClusterScoreMatrix.ts')
    return executeClusterScoreMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
