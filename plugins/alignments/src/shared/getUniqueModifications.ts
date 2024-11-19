import { IAnyStateTreeNode } from 'mobx-state-tree'
import { BlockSet } from '@jbrowse/core/util/blockTypes'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { ModificationType } from './types'

export async function getUniqueModifications({
  self,
  adapterConfig,
  blocks,
  opts,
}: {
  self: IAnyStateTreeNode
  adapterConfig: AnyConfigurationModel
  blocks: BlockSet
  opts?: {
    headers?: Record<string, string>
    stopToken?: string
    filters: string[]
  }
}) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    sessionId,
    'PileupGetVisibleModifications',
    {
      adapterConfig,
      sessionId,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values as ModificationType[]
}
