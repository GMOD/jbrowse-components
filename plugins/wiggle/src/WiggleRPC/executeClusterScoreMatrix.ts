import { clusterData } from '@gmod/hclust'

import { getScoreMatrix } from './getScoreMatrix.ts'

import type { GetScoreMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function executeClusterScoreMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: GetScoreMatrixArgs
}) {
  const matrix = await getScoreMatrix({
    pluginManager,
    args,
  })
  return clusterData({
    data: Object.values(matrix),
    stopToken: args.stopToken,
    onProgress: a => {
      args.statusCallback?.(a)
    },
  })
}
