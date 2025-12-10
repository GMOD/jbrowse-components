import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { type IAnyStateTreeNode, isAlive } from '@jbrowse/mobx-state-tree'

import type { ModificationType } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BlockSet } from '@jbrowse/core/util/blockTypes'

export interface ModificationOpts {
  headers?: Record<string, string>
  stopToken?: string
  filters: string[]
}

export async function getUniqueModifications({
  model,
  adapterConfig,
  blocks,
  opts,
}: {
  model: IAnyStateTreeNode & { effectiveRpcDriverName?: string }
  adapterConfig: AnyConfigurationModel
  blocks: BlockSet
  opts?: ModificationOpts
}) {
  const { rpcManager } = getSession(model)
  const sessionId = getRpcSessionId(model)
  const values = await rpcManager.call(
    sessionId,
    'PileupGetVisibleModifications',
    {
      adapterConfig,
      sessionId,
      regions: blocks.contentBlocks,
      rpcDriverName: model.effectiveRpcDriverName,
      statusCallback: (arg: string) => {
        if (isAlive(model)) {
          model.setMessage(arg)
        }
      },
      ...opts,
    },
  )
  return values as {
    modifications: ModificationType[]
    simplexModifications: string[]
  }
}
