import { getRpcHost } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import type { ClusterRunArgs } from './types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The dialog's half of `ClusterRunArgs`: the RPC host, the session id and the
 * visible blocks, joined to the handles the tab in play created. Thrown rather
 * than declined on an uninitialized view, so the tab reports it beside the
 * button the way it reports an RPC failure.
 */
export function resolveClusterRunArgs(
  model: IAnyStateTreeNode,
  handles: Pick<ClusterRunArgs, 'stopToken' | 'statusCallback'>,
): ClusterRunArgs {
  const view = containingLgv(model)
  if (!view.initialized) {
    throw new Error(
      'The view is not initialized yet, please wait and try again',
    )
  }
  return {
    rpcManager: getRpcHost(model).rpcManager,
    sessionId: getRpcSessionId(model),
    regions: view.dynamicBlocks.contentBlocks,
    ...handles,
  }
}
