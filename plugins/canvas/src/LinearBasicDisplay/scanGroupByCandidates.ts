import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import type { GetGroupByCandidatesArgs } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface GroupByScanModel extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  // The same admission the render fetch sends, so a value only filtered-out
  // features carry never counts as a section.
  rpcProps: () => Pick<
    GetGroupByCandidatesArgs,
    'displayConfig' | 'showOnlyGenes' | 'soloFeatureIds' | 'hiddenFeatureIds'
  >
  // The display's own gate budget, so the scan is refused wherever the render
  // fetch would be rather than downloading a region the track refused.
  resolvedByteLimit: () => number | undefined
}

export interface GroupByScanOptions {
  signal: AbortSignal
  statusCallback: StatusCallback
}

// The attributes the features in view carry and the sections each would
// make, read off the render fetch's own download over the visible blocks.
export function scanGroupByCandidates(
  self: GroupByScanModel,
  opts: GroupByScanOptions,
) {
  const { displayConfig, showOnlyGenes, soloFeatureIds, hiddenFeatureIds } =
    self.rpcProps()
  return getSession(self).rpcManager.call(
    getRpcSessionId(self),
    'GetCanvasGroupByCandidates',
    {
      adapterConfig: self.adapterConfig,
      displayConfig,
      showOnlyGenes,
      soloFeatureIds,
      hiddenFeatureIds,
      byteLimit: self.resolvedByteLimit(),
      regions: containingLgv(self).staticBlocks.contentBlocks,
      ...opts,
    },
  )
}
