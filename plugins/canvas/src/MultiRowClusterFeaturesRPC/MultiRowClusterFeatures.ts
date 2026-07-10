import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { MultiRowClusterFeaturesArgs } from './rpcTypes.ts'

// "Cluster rows by similarity" for LinearMultiRowFeatureDisplay: fetches the
// visible features, builds a per-row × per-bin color-category matrix, and
// hierarchically clusters it into a leaf `order` + newick `tree`. The multi-row
// analogue of MultiWiggleClusterScoreMatrix; both feed the shared
// buildClusteredLayout / setLayoutAndClusterTree path.
export default class MultiRowClusterFeatures extends RpcMethodTypeWithRenameRegions {
  name = 'MultiRowClusterFeatures'

  async execute(args: MultiRowClusterFeaturesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeMultiRowClusterFeatures } =
      await import('./executeMultiRowClusterFeatures.ts')
    return executeMultiRowClusterFeatures({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
  }
}
