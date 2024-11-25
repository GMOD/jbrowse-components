import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { isAlive } from 'mobx-state-tree'
import type { LinearGenomeViewModel } from '../../LinearGenomeView'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export interface RenderProps {
  rendererType: any
  renderArgs: Record<string, any>
  renderProps: Record<string, any>
  displayError: unknown
  rpcManager: { call: (...args: unknown[]) => void }
  cannotBeRenderedReason: string
}

export interface ErrorProps {
  displayError: string
}

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
export function getId(id: string, index: number) {
  const notJest = typeof jest === 'undefined'
  return ['clip', notJest ? id : 'jest', index, notJest ? Math.random() : '']
    .filter(f => !!f)
    .join('-')
}

export async function getFeatureDensityStatsPre(
  self: IAnyStateTreeNode & {
    adapterConfig?: AnyConfigurationModel
    setMessage: (arg: string) => void
  },
) {
  const view = getContainingView(self) as LinearGenomeViewModel
  const regions = view.staticBlocks.contentBlocks

  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  if (!adapterConfig) {
    // A track extending the base track might not have an adapter config
    // e.g. Apollo tracks don't use adapters
    return {}
  }
  const sessionId = getRpcSessionId(self)

  return rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
    sessionId,
    regions,
    adapterConfig,
    statusCallback: (message: string) => {
      if (isAlive(self)) {
        self.setMessage(message)
      }
    },
  }) as Promise<FeatureDensityStats>
}
