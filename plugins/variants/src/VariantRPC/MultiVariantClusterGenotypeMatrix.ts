import { clusterData, toNewick } from '@gmod/hclust'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { getGenotypeMatrix } from './getGenotypeMatrix'

import type { ClusterGenotypeMatrixArgs } from './types'

export class MultiVariantClusterGenotypeMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiVariantClusterGenotypeMatrix'

  async execute(args: ClusterGenotypeMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const matrix = await getGenotypeMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
    const sampleLabels = Object.keys(matrix)
    const result = await clusterData({
      data: Object.values(matrix),
      sampleLabels,
      stopToken: deserializedArgs.stopToken,
      onProgress: progress => {
        deserializedArgs.statusCallback(progress)
      },
    })
    return {
      order: result.order,
      tree: toNewick(result.tree),
    }
  }
}
