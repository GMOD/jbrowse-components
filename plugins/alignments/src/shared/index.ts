import { types, IAnyStateTreeNode } from 'mobx-state-tree'
import { BlockSet } from '@jbrowse/core/util/blockTypes'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

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

type Track = IAnyStateTreeNode & { configuration: AnyConfigurationModel }

export async function getUniqueModificationValues(
  self: IAnyStateTreeNode & {
    parentTrack: Track
  },
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

export const FilterModel = types.model({
  flagInclude: types.optional(types.number, 0),
  flagExclude: types.optional(types.number, 1540),
  readName: types.maybe(types.string),
  tagFilter: types.maybe(
    types.model({
      tag: types.string,
      value: types.string,
    }),
  ),
})
