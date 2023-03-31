import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { IAnyStateTreeNode, isAlive } from 'mobx-state-tree'
import { LinearGenomeViewModel } from '../../LinearGenomeView'

export interface RenderProps {
  rendererType: any // eslint-disable-line @typescript-eslint/no-explicit-any
  renderArgs: { [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  renderProps: { [key: string]: any } // eslint-disable-line @typescript-eslint/no-explicit-any
  displayError: unknown
  rpcManager: { call: Function }
  cannotBeRenderedReason: string
}

export interface ErrorProps {
  displayError: string
}

export function getDisplayStr(totalBytes: number) {
  let displayBp
  if (Math.floor(totalBytes / 1000000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000000).toPrecision(3))} Mb`
  } else if (Math.floor(totalBytes / 1000) > 0) {
    displayBp = `${Number.parseFloat((totalBytes / 1000).toPrecision(3))} Kb`
  } else {
    displayBp = `${Math.floor(totalBytes)} bytes`
  }
  return displayBp
}

// stabilize clipid under test for snapshot
export function getId(id: string, index: number) {
  const isJest = typeof jest === 'undefined'
  return `clip-${isJest ? id : 'jest'}-${index}`
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
