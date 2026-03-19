import { clusterData, toNewick } from '@gmod/hclust'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

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
  const { stopToken } = args
  const matrix = await getScoreMatrix({
    pluginManager,
    args,
  })
  const sampleLabels = Object.keys(matrix)
  const result = await clusterData({
    data: Object.values(matrix),
    sampleLabels,
    checkCancellation: stopToken
      ? () => {
          try {
            checkStopToken(stopToken)
            return false
          } catch {
            return true
          }
        }
      : undefined,
    onProgress: a => {
      args.statusCallback?.(a)
    },
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}
