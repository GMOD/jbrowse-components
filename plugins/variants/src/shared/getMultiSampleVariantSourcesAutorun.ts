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
import type { RpcStatus, StatusWindow } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getMultiSampleVariantSourcesAutorun(
  self: IStateTreeNode & {
    adapterConfig: Record<string, unknown>
    isMinimized: boolean
    reloadCount: number
    setError: (error?: unknown) => void
    setStatusMessage: (status?: RpcStatus) => void
    // This display composes the LGV fetch mixins, so it already owns a status
    // window; lending it to the rotation is what keeps this fetch and the region
    // fetches thinning through ONE of them rather than two writing the same
    // field.
    statusWindow: StatusWindow
    setSources: (sources: Source[]) => void
  },
) {
  // Owns this fetch's stop-token rotation + latest-wins guard so a superseded
  // run (reloadCount bump, adapterConfig change) can't clobber fresher sources.
  const rotation = createStopTokenRotation(self, self)
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
          const session = getSession(self)
          const { rpcManager } = session
          const { adapterConfig } = self
          const { stopToken, isCurrent, statusCallback, end } = rotation.begin()
          try {
            const { sources, warnings } = await rpcManager.call(
              getRpcSessionId(self),
              'MultiSampleVariantGetSources',
              { adapterConfig, stopToken, statusCallback },
            )
            if (isCurrent()) {
              self.setSources(sources)
              // A `samplesTsv` that matches only some of the VCF's samples
              // still draws, but silently dropping the rest is a config
              // mistake worth surfacing — and this fetch runs in the worker,
              // whose console nobody is looking at. `notify` dedupes by
              // message, so a refetch of the same file doesn't stack them.
              for (const warning of warnings) {
                console.warn(warning)
                session.notify(warning, 'warning')
              }
            }
          } finally {
            // The clear this fetch had never had. Nothing else drops the label:
            // `getSources` has no index to consult and scans every feature in
            // every region, so it reports for as long as that takes, and a
            // failure partway left the last status standing with
            // `DisplayBackgroundProgress` rendering a chip off it for good.
            end()
          }
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
            self.setError(e)
            // The sample list is a prerequisite for everything this display
            // draws, so a failure here is not a partial result — the band is
            // empty either way. `samplesTsvLocation` naming no VCF sample is
            // the case that needs it most: it used to leave `sources` as an
            // empty array, which is truthy, so no loading state and no banner
            // showed and the display just drew nothing.
            getSession(self).notifyError(`${e}`, e)
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
