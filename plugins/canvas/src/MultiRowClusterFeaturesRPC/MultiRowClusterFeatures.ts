import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type {
  MultiRowClusterFeaturesArgs,
  MultiRowClusterFeaturesResult,
} from './rpcTypes.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// The augmentation belongs beside the class, not in rpcTypes.ts: a consuming
// project compiles this plugin through the project-reference source redirect,
// whose program holds only what the import graph reaches. An augmentation in a
// file nobody imports is absent there, and every call site degrades to
// NotInRpcRegistry. index.ts reaches this file, so declaring it here cannot go
// missing.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiRowClusterFeatures: {
      args: MultiRowClusterFeaturesArgs
      return: MultiRowClusterFeaturesResult
    }
  }
}

// "Cluster rows by similarity" for LinearMultiRowFeatureDisplay: fetches the
// visible features, builds a per-row × per-bin color-category matrix, and
// hierarchically clusters it into a leaf `order` + newick `tree`. The multi-row
// analogue of MultiWiggleClusterScoreMatrix; both feed the shared
// buildClusteredLayout / setLayoutAndClusterTree path.
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
