import { clusterMatrix } from '@jbrowse/tree-sidebar/clusterMatrix'

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
  const matrix = await getScoreMatrix({ pluginManager, args })
  return clusterMatrix({
    data: matrix,
    statusCallback: args.statusCallback,
    signal: args.signal,
  })
}
