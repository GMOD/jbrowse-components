import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'
import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'

import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatureMatrix: {
      args: MultiRowClusterFeaturesArgs
      return: Map<string, Float32Array<ArrayBuffer>>
      // wrapped in rpcResult so postMessage transfers its buffers
      transferables: true
    }
  }
}

// The matrix `MultiRowClusterFeatures` clusters, handed back unclustered for
// the cluster dialog's R-script tab — the multi-row analogue of
// `MultiWiggleGetScoreMatrix`.
export default class MultiRowGetFeatureMatrix extends RpcMethodTypeWithRenameRegions<'MultiRowGetFeatureMatrix'> {
  name = 'MultiRowGetFeatureMatrix' as const

  async execute(args: RpcExecuteArgs<'MultiRowGetFeatureMatrix'>) {
    const { collectMultiRowMatrix } = await import('./collectMultiRowMatrix.ts')
    const matrix = await collectMultiRowMatrix({
      pluginManager: this.pluginManager,
      args,
      stopTokenCheck: createStopTokenChecker(args.stopToken),
    })
    return rpcResultWithArrayBuffers(matrix)
  }
}
