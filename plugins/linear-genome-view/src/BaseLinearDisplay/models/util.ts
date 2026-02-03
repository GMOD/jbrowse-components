import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from '@jbrowse/mobx-state-tree'

import type { LinearGenomeViewModel } from '../../LinearGenomeView/index.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

export function getDisplayStr(totalBytes: number) {
  if (Math.floor(totalBytes / 1000000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    return `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    return `${Math.floor(totalBytes)} bytes`
  }
}

// stabilize clipid under test for snapshot
export function getId(id: string, index: string | number) {
  const notJest = typeof jest === 'undefined'
  return ['clip', notJest ? id : 'jest', index, notJest ? Math.random() : '']
    .filter(f => !!f)
    .join('-')
}

export async function getFeatureDensityStatsPre(self: {
  adapterConfig?: AnyConfigurationModel
  setStatusMessage: (arg: string) => void
  effectiveRpcDriverName?: string
}) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const regions = view.staticBlocks.contentBlocks

  const { rpcManager } = getSession(self)
  const { adapterConfig, effectiveRpcDriverName } = self
  if (!adapterConfig) {
    // A track extending the base track might not have an adapter config
    // e.g. Apollo tracks don't use adapters
    return {}
  } else {
    const sessionId = getRpcSessionId(self)

    return rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
      sessionId,
      regions,
      adapterConfig,
      rpcDriverName: effectiveRpcDriverName,
      statusCallback: (message: string) => {
        if (isAlive(self)) {
          self.setStatusMessage(message)
        }
      },
    }) as Promise<FeatureDensityStats>
  }
}
