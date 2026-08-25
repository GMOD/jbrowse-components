import { createStopTokenChecker } from '@jbrowse/core/util/stopToken'
import { clusterMatrix } from '@jbrowse/tree-sidebar'

import { collectMultiRowMatrix } from './collectMultiRowMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeMultiRowClusterFeatures({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'MultiRowClusterFeatures'>
}) {
  const stopTokenCheck = createStopTokenChecker(args.stopToken)
  return clusterMatrix({
    data: await collectMultiRowMatrix({ pluginManager, args, stopTokenCheck }),
    statusCallback: args.statusCallback,
    stopTokenCheck,
  })
}
