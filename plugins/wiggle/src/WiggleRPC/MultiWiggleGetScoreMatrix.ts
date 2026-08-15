import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import type { GetScoreMatrixArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleGetScoreMatrix: {
      args: GetScoreMatrixArgs
      return: Map<string, Float32Array<ArrayBuffer>>
    }
  }
}

export class MultiWiggleGetScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiWiggleGetScoreMatrix'> {
  name = 'MultiWiggleGetScoreMatrix' as const

  async execute(
    args: RpcExecuteArgs<'MultiWiggleGetScoreMatrix'>,
    rpcDriverClassName: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )

    const stopTokenCheck = createStopTokenChecker(deserializedArgs.stopToken)
    const { getScoreMatrix } = await import('./getScoreMatrix.ts')
    const matrix = await getScoreMatrix({
      args: { ...deserializedArgs, stopTokenCheck },
      pluginManager: this.pluginManager,
    })
    const buffers: ArrayBuffer[] = []
    for (const arr of matrix.values()) {
      buffers.push(arr.buffer)
    }
    return rpcResult(matrix, buffers)
  }
}
