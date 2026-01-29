import { clusterData, toNewick } from '@gmod/hclust'

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
  const sampleLabels = Object.keys(matrix)
  const result = await clusterData({
    data: Object.values(matrix),
    sampleLabels,
    stopToken: args.stopToken,
    onProgress: a => {
      args.statusCallback?.(a)
    },
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}
