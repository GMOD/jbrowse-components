import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

import { getScoreMatrix } from './getScoreMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeClusterScoreMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiWiggleClusterScoreMatrix'>
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
