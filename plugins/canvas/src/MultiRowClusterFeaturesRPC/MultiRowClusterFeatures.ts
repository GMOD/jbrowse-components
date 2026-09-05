import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type {
  MultiRowClusterFeaturesArgs,
  MultiRowClusterFeaturesResult,
} from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// The augmentation has to sit in a file the import graph reaches: a consuming
// project compiles this plugin through the project-reference source redirect,
// and an augmentation nobody imports leaves every call site at
// NotInRpcRegistry.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowClusterFeatures: {
      args: MultiRowClusterFeaturesArgs
      return: MultiRowClusterFeaturesResult
    }
  }
}

export default class MultiRowClusterFeatures extends RpcMethodTypeWithRenameRegions<'MultiRowClusterFeatures'> {
  name = 'MultiRowClusterFeatures' as const

  async execute(args: RpcExecuteArgs<'MultiRowClusterFeatures'>) {
    const { executeMultiRowClusterFeatures } =
      await import('./executeMultiRowClusterFeatures.ts')
    return executeMultiRowClusterFeatures({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
