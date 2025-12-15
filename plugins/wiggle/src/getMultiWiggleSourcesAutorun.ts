import { getContainingView, getSession } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export interface Source {
  name: string
  source: string
  color?: string
  group?: string
}

export function getMultiWiggleSourcesAutorun(self: {
  quantitativeStatsReady: boolean
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  autoscaleType: string
  adapterProps: () => Record<string, unknown>
  setSourcesLoading: (aborter: string) => void
  setError: (error: unknown) => void
  setStatusMessage: (str: string) => void
  setSources: (sources: Source[]) => void
}) {
  addDisposer(
    self,
    autorun(async () => {
      try {
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const { rpcManager } = getSession(self)
        const { adapterConfig } = self
        const token = createStopToken()
        self.setSourcesLoading(token)
        const sessionId = getRpcSessionId(self)
        const sources = (await rpcManager.call(
          sessionId,
          'MultiWiggleGetSources',
          {
            regions: view.staticBlocks.contentBlocks,
            sessionId,
            adapterConfig,
            statusCallback: (arg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(arg)
              }
            },
          },
        )) as Source[]
        if (isAlive(self)) {
          self.setSources(sources)
        }
      } catch (e) {
        if (!isAbortException(e) && isAlive(self)) {
          console.error(e)
          getSession(self).notifyError(`${e}`, e)
        }
      }
    }),
  )
}
