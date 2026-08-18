import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import type { GetScoreMatrixArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiWiggleGetScoreMatrix: {
      args: GetScoreMatrixArgs
      return: Map<string, Float32Array<ArrayBuffer>>
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

export class MultiWiggleGetScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiWiggleGetScoreMatrix'> {
  name = 'MultiWiggleGetScoreMatrix' as const

  async execute(args: RpcExecuteArgs<'MultiWiggleGetScoreMatrix'>) {
    const stopTokenCheck = createStopTokenChecker(args.stopToken)
    const { getScoreMatrix } = await import('./getScoreMatrix.ts')
    const matrix = await getScoreMatrix({
      args: { ...args, stopTokenCheck },
      pluginManager: this.pluginManager,
    })
    // derived, not the hand loop this replaced: that list was correct and
    // `rpcResult`'s under-test check called every entry of it "not in the
    // payload", because neither walk could see into a Map. Nothing here reached
    // `execute` under test, so the report was waiting for the first caller who
    // did.
    return rpcResultWithArrayBuffers(matrix)
  }
}
