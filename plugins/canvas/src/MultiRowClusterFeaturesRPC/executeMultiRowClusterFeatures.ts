import { clusterMatrix } from '@jbrowse/tree-sidebar/clusterMatrix'

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
  const { rows, encoding } = await collectMultiRowMatrix({
    pluginManager,
    args,
  })
  return {
    ...(await clusterMatrix({
      data: rows,
      statusCallback: args.statusCallback,
      signal: args.signal,
    })),
    encoding,
  }
}
