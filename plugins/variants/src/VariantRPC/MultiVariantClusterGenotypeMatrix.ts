import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { clusterData } from '@jbrowse/core/util/cluster'

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
    return clusterData({
      data: Object.values(matrix),
      stopToken: deserializedArgs.stopToken,
      onProgress: progress => {
        deserializedArgs.statusCallback(progress)
      },
    })
  }
}
