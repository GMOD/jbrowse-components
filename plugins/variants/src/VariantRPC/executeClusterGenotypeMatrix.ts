import { clusterData, toNewick } from '@gmod/hclust'

import { getGenotypeMatrix } from './getGenotypeMatrix'

import type { ClusterGenotypeMatrixArgs } from './types'
import type PluginManager from '@jbrowse/core/PluginManager'

export async function executeClusterGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ClusterGenotypeMatrixArgs
}) {
  const matrix = await getGenotypeMatrix({
    pluginManager,
    args,
  })
  const sampleLabels = Object.keys(matrix)
  const result = await clusterData({
    data: Object.values(matrix),
    sampleLabels,
    stopToken: args.stopToken,
    onProgress: args.statusCallback,
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}
