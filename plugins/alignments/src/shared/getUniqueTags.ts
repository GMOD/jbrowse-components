import { IAnyStateTreeNode } from 'mobx-state-tree'
import { BlockSet } from '@jbrowse/core/util/blockTypes'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

export async function getUniqueTags({
  self,
  tag,
  blocks,
  opts,
}: {
  self: IAnyStateTreeNode & { adapterConfig: AnyConfigurationModel }
  tag: string
  blocks: BlockSet
  opts?: {
    headers?: Record<string, string>
    stopToken?: string
    filters: string[]
  }
}) {
  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    getRpcSessionId(self),
    'PileupGetGlobalValueForTag',
    {
      adapterConfig,
      tag,
      sessionId,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values as string[]
}
