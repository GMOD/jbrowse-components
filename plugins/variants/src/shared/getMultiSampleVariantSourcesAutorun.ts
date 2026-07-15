import {
  createStopTokenRotation,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { Source } from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiSampleVariantSourcesAutorun(
  self: IAnyStateTreeNode & {
    adapterConfig: AnyConfigurationModel
    isMinimized: boolean
    reloadCount: number
    setError: (error?: unknown) => void
    setStatusMessage: (status?: RpcStatus) => void
    setSources: (sources: Source[]) => void
  },
) {
  // Owns this fetch's stop-token rotation + latest-wins guard so a superseded
  // run (reloadCount bump, adapterConfig change) can't clobber fresher sources.
  const rotation = createStopTokenRotation(self)
  addDisposer(self, () => {
    rotation.dispose()
  })
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          // isAlive check guards against display being destroyed during async import
          if (!isAlive(self) || self.isMinimized) {
            return
          }
          void self.reloadCount
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return
          }
          const { rpcManager } = getSession(self)
          const { adapterConfig } = self
          const { stopToken, isCurrent, statusCallback } = rotation.begin()
          const sources = await rpcManager.call(
            getRpcSessionId(self),
            'MultiSampleVariantGetSources',
            { adapterConfig, stopToken, statusCallback },
          )
          if (isCurrent()) {
            self.setSources(sources)
          }
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
            self.setError(e)
          }
        }
      },
      {
        delay: 1000,
        name: 'GetMultiSampleVariantSources',
      },
    ),
  )
}
