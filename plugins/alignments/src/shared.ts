import { BlockSet } from '@jbrowse/core/util/blockTypes'

import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

export async function getUniqueTagValues(
  self: IAnyStateTreeNode & { adapterConfig: AnyConfigurationModel },
  colorScheme: { type: string; tag?: string },
  blocks: BlockSet,
  opts?: {
    headers?: Record<string, string>
    signal?: AbortSignal
    filters?: string[]
  },
) {
  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    getRpcSessionId(self),
    'PileupGetGlobalValueForTag',
    {
      adapterConfig,
      tag: colorScheme.tag,
      sessionId,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values as string[]
}

export async function getUniqueModificationValues(
  self: IAnyStateTreeNode,
  adapterConfig: AnyConfigurationModel,
  colorScheme: { type: string; tag?: string },
  blocks: BlockSet,
  opts?: {
    headers?: Record<string, string>
    signal?: AbortSignal
    filters?: string[]
  },
) {
  const { rpcManager } = getSession(self)
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    sessionId,
    'PileupGetVisibleModifications',
    {
      adapterConfig,
      tag: colorScheme.tag,
      sessionId,
      regions: blocks.contentBlocks,
      ...opts,
    },
  )
  return values as string[]
}
