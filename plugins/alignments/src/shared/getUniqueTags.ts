import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { FilterBy } from './types.ts'
import type { StatusCallback } from '@jbrowse/core/util'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// The distinct values a tag takes over the visible blocks, under the display's
// own read filter — `filterBy` comes off `self` beside `adapterConfig` because
// both describe the same fetch, and a caller that passed one without the other
// would be enumerating a different read set than the track draws.
export async function getUniqueTags({
  self,
  tag,
  blocks,
  opts,
}: {
  self: {
    adapterConfig: Record<string, unknown>
    filterBy: FilterBy
  }
  tag: string
  blocks: BlockSet
  opts?: {
    stopToken?: StopToken
    statusCallback?: StatusCallback
  }
}) {
  const { rpcManager } = getSession(self)
  const { adapterConfig, filterBy } = self
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    sessionId,
    'PileupGetGlobalValueForTag',
    {
      adapterConfig,
      tag,
      filterBy,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values
}
