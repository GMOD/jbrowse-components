import { getRpcHost } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import type { ClusterRunArgs } from './types.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/** The visible blocks on the track's genomes, which a run clusters by default. */
export function clusterRunRegions(model: IStateTreeNode) {
  const onTrack = onTrackAssembly(model)
  return containingLgv(model).dynamicBlocks.contentBlocks.filter(b =>
    onTrack(b.assemblyName),
  )
}

/**
 * `ClusterRunArgs` for a run over `regions`: the display's RPC host and session
 * id joined to the handles the caller created. Both entry points build it here,
 * so neither can reach for a different session id and land its RPC on another
 * worker's adapter cache.
 */
export function clusterRunArgs(
  model: IStateTreeNode,
  regions: Region[],
  handles: Pick<ClusterRunArgs, 'signal' | 'statusCallback'>,
): ClusterRunArgs {
  return {
    rpcManager: getRpcHost(model).rpcManager,
    sessionId: getRpcSessionId(model),
    regions,
    ...handles,
  }
}

/**
 * The dialog's `ClusterRunArgs`, over the visible blocks. Thrown rather than
 * declined on an uninitialized view, so the tab reports it beside the button
 * the way it reports an RPC failure.
 */
export function resolveClusterRunArgs(
  model: IStateTreeNode,
  handles: Pick<ClusterRunArgs, 'signal' | 'statusCallback'>,
) {
  if (!containingLgv(model).initialized) {
    throw new Error(
      'The view is not initialized yet, please wait and try again',
    )
  }
  return clusterRunArgs(model, clusterRunRegions(model), handles)
}
