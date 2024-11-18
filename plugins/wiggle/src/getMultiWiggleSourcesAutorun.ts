import { autorun } from 'mobx'
import { addDisposer, isAlive } from 'mobx-state-tree'
// jbrowse
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

export interface Source {
  name: string
  color?: string
  group?: string
}

export function getMultiWiggleSourcesAutorun(self: {
  quantitativeStatsReady: boolean
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  autoscaleType: string
  adapterProps: () => Record<string, unknown>
  setStatsLoading: (aborter: AbortController) => void
  setError: (error: unknown) => void
  setMessage: (str: string) => void
  setSources: (sources: Source[]) => void
}) {
  addDisposer(
    self,
    autorun(async () => {
      try {
        const { rpcManager } = getSession(self)
        const { adapterConfig } = self
        const sessionId = getRpcSessionId(self)
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const sources = (await rpcManager.call(
          sessionId,
          'MultiWiggleGetSources',
          {
            regions: view.staticBlocks.contentBlocks,
            sessionId,
            adapterConfig,
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
