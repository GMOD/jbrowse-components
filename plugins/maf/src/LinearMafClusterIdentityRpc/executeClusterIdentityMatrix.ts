import { clusterMatrix } from '@jbrowse/tree-sidebar/clusterMatrix'

import { buildIdentityMatrix } from './buildIdentityMatrix.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeClusterIdentityMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'LinearMafClusterIdentityMatrix'>
}) {
  const data = await buildIdentityMatrix({
    pluginManager,
    args,
  })
  // No imputation step, unlike the genotype path: every cell here is a ratio of
  // two counts and an uncovered bin resolves to 0 rather than to a no-call, so
  // the matrix is finite by construction and hclust has nothing to reject.
  return clusterMatrix({
    data,
    statusCallback: args.statusCallback,
    signal: args.signal,
  })
}
