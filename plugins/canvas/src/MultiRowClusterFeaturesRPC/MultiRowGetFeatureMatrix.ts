import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowGetFeatureMatrix: {
      args: MultiRowClusterFeaturesArgs
      return: Map<string, Float32Array<ArrayBuffer>>
      transferables: true
    }
  }
}

export default class MultiRowGetFeatureMatrix extends RpcMethodTypeWithRenameRegions<'MultiRowGetFeatureMatrix'> {
  name = 'MultiRowGetFeatureMatrix' as const

  async execute(args: RpcExecuteArgs<'MultiRowGetFeatureMatrix'>) {
    const { collectMultiRowMatrix } = await import('./collectMultiRowMatrix.ts')
    const { rows } = await collectMultiRowMatrix({
      pluginManager: this.pluginManager,
      args,
    })
    return rpcResultWithArrayBuffers(rows)
  }
}
