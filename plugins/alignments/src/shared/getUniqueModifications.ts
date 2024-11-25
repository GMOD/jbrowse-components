import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import type { ModificationType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

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
