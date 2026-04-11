import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { getScoreMatrix } from './getScoreMatrix.ts'

import type { GetScoreMatrixArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleGetScoreMatrix: {
      args: GetScoreMatrixArgs
      return: Record<string, number[]>
    }
  }
}

export class MultiWiggleGetScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleGetScoreMatrix'

  async execute(args: GetScoreMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )

    const stopTokenCheck = createStopTokenChecker(deserializedArgs.stopToken)
    return getScoreMatrix({
      args: { ...deserializedArgs, stopTokenCheck },
      pluginManager: this.pluginManager,
    })
  }
}
