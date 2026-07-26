import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

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
  return clusterMatrix({
    data: matrix,
    statusCallback: args.statusCallback,
    stopTokenCheck,
  })
}
