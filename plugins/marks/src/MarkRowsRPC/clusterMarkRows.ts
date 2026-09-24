import { clusterMatrix } from '@jbrowse/tree-sidebar/clusterMatrix'

import { collectMarkRowMatrix } from './collectMarkRowMatrix.ts'

import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'

export async function clusterMarkRows({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MarkRowMatrixArgs & RpcCallContext
}) {
  return clusterMatrix({
    data: await collectMarkRowMatrix({ pluginManager, args }),
    statusCallback: args.statusCallback,
    signal: args.signal,
  })
}
