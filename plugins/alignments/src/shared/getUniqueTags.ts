import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { onTrackAssembly } from '@jbrowse/display-kit/foundationView'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'

import type { ReadFilter } from './types.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// The distinct values a tag takes over the visible blocks on the track's
// genomes, under the display's own read filter — `filterBy` comes off `self`
// beside `adapterConfig` because both describe the same fetch, and a caller
// that passed one without the other would be enumerating a different read set
// than the track draws.
//
// Answers a `RegionTooLargeResult` instead where the display's own gate refuses
// the region, for the same reason `resolvedByteLimit` is read off `self` here:
// this scan is the render fetch's download without its budget, and the two have
// to agree about which regions are affordable.
export async function getUniqueTags({
  self,
  tag,
  opts,
}: {
  self: IStateTreeNode & {
    adapterConfig: Record<string, unknown>
    readFilter: ReadFilter
    resolvedByteLimit: () => number | undefined
  }
  tag: string
  opts?: {
    signal?: AbortSignal
    statusCallback?: StatusCallback
  }
}) {
  const { rpcManager } = getSession(self)
  const { adapterConfig, readFilter: filterBy } = self
  const sessionId = getRpcSessionId(self)
  const onTrack = onTrackAssembly(self)
  return rpcManager.call(sessionId, 'PileupGetGlobalValueForTag', {
    adapterConfig,
    tag,
    filterBy,
    byteLimit: self.resolvedByteLimit(),
    regions: containingLgv(self).staticBlocks.contentBlocks.filter(b =>
      onTrack(b.assemblyName),
    ),
    ...opts,
  })
}
