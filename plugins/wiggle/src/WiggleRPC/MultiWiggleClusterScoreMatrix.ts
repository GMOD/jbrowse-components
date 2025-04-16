import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'
import { clusterData } from '@jbrowse/core/util/cluster'

import { getScoreMatrix } from './getScoreMatrix'

import type { GetScoreMatrixArgs } from './types'

export class MultiWiggleClusterScoreMatrix extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'MultiWiggleClusterScoreMatrix'

  async execute(args: GetScoreMatrixArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const matrix = await getScoreMatrix({
      pluginManager: this.pluginManager,
      args: deserializedArgs,
    })
    return clusterData({
      data: Object.values(matrix),
      stopToken: deserializedArgs.stopToken,
      onProgress: a => {
        deserializedArgs.statusCallback?.(a)
      },
    })
  }
}
