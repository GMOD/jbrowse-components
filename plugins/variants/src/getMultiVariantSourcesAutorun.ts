import { getContainingView, getSession } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'

import type { Source } from './shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiVariantSourcesAutorun(self: {
  configuration: AnyConfigurationModel
  adapterConfig: AnyConfigurationModel
  adapterProps: () => Record<string, unknown>
  setSourcesLoading: (aborter: string) => void
  setError: (error: unknown) => void
  setMessage: (str: string) => void
  setSources: (sources: Source[]) => void
}) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return
          }
          const { rpcManager } = getSession(self)
          const { adapterConfig } = self
          const stopToken = createStopToken()
          self.setSourcesLoading(stopToken)
          const sessionId = getRpcSessionId(self)
          const sources = (await rpcManager.call(
            sessionId,
            'MultiVariantGetSources',
            {
              sessionId,
              adapterConfig,
              stopToken,
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
      },
      { delay: 1000 },
    ),
  )
}
