import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { StatusCallback } from '@jbrowse/core/util'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export async function getUniqueTags({
  self,
  tag,
  blocks,
  opts,
}: {
  self: {
    adapterConfig: Record<string, unknown>
  }
  tag: string
  blocks: BlockSet
  opts?: {
    headers?: Record<string, string>
    stopToken?: StopToken
    statusCallback?: StatusCallback
    filters?: string[]
  }
}) {
  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    sessionId,
    'PileupGetGlobalValueForTag',
    {
      adapterConfig,
      tag,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values
}
