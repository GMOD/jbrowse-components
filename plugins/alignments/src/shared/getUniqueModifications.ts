import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { ModificationType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export interface ModificationOpts {
  headers?: Record<string, string>
  stopToken?: string
  filters: string[]
}

export async function getUniqueModifications({
  self,
  adapterConfig,
  blocks,
  opts,
}: {
  self: IAnyStateTreeNode
  adapterConfig: AnyConfigurationModel
  blocks: BlockSet
  opts?: ModificationOpts
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
      statusCallback: (arg: string) => {
        console.log(arg)
        self.setMessage(arg)
      },
      ...opts,
    },
  )
  return values as ModificationType[]
}
