import { getRpcHost } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import type { ClusterRunArgs } from './types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The dialog's half of `ClusterRunArgs`: the RPC host, the session id and the
 * visible blocks on the track's genomes, joined to the handles the tab in play created. Thrown rather
 * than declined on an uninitialized view, so the tab reports it beside the
 * button the way it reports an RPC failure.
 */
export function resolveClusterRunArgs(
  model: IStateTreeNode,
  handles: Pick<ClusterRunArgs, 'signal' | 'statusCallback'>,
): ClusterRunArgs {
  const view = containingLgv(model)
  const onTrack = onTrackAssembly(model)
  if (!view.initialized) {
    throw new Error(
      'The view is not initialized yet, please wait and try again',
    )
  }
  return {
    rpcManager: getRpcHost(model).rpcManager,
    sessionId: getRpcSessionId(model),
    regions: view.dynamicBlocks.contentBlocks.filter(b =>
      onTrack(b.assemblyName),
    ),
    ...handles,
  }
}
