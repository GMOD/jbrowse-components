import { clusterObject, toNewick } from '@gmod/hclust'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

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
  const stopTokenCheck = createStopTokenChecker(args.stopToken)
  const matrix = await getScoreMatrix({
    pluginManager,
    args: {
      ...args,
      stopTokenCheck,
    },
  })
  const result = await clusterObject({
    data: matrix,
    onProgress: a => {
      args.statusCallback?.(a)
    },
    checkCancellation: () => {
      checkStopToken2(stopTokenCheck)
    },
  })
  return {
    order: result.order,
    tree: toNewick(result.tree),
  }
}
