import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import { getScoreMatrix } from './getScoreMatrix.ts'

import type { GetScoreMatrixArgs } from './types.ts'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleGetScoreMatrix: {
      args: GetScoreMatrixArgs
      return: Record<string, Float32Array>
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
    const matrix = await getScoreMatrix({
      args: { ...deserializedArgs, stopTokenCheck },
      pluginManager: this.pluginManager,
    })
    return rpcResult(
      matrix,
      Object.values(matrix).map(arr => arr.buffer as ArrayBuffer),
    )
  }
}
