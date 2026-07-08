import { getContainingView, getSession } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { runWiggleClustering } from './runWiggleClustering.ts'

import type { ReducedModel } from './components/WiggleClusterDialog/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Declarative counterpart to the "Cluster columns" -> "Run clustering"
// dialog, following the same transient-launch-spec pattern as
// LinearGenomeView's `init` (and its sibling for multi-sample variants,
// getMultiSampleVariantClusterAutorun): a session/config sets
// `runClustering: true` on the display, the real clustering RPC runs once
// automatically at the default sampling density, and the flag is cleared
// afterwards (setRunClustering(undefined)) so a saved session never
// re-triggers it.
export function getWiggleClusterAutorun(
  self: IAnyStateTreeNode &
    ReducedModel & {
      runClustering?: boolean
      setRunClustering: (arg?: boolean) => void
    },
) {
  // Plain closure flag (not observable) guards re-entrant runs while the RPC
  // is in flight, the same trick setupInitAutorun uses for `init`.
  let applying = false
  addDisposer(
    self,
    autorun(
      async () => {
        const { runClustering, sourcesWithoutLayout } = self
        if (!runClustering || applying || !sourcesWithoutLayout.length) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        applying = true
        const stopToken = createStopToken()
        try {
          await runWiggleClustering({
            model: self,
            rpcManager: getSession(self).rpcManager,
            sessionId: getRpcSessionId(self),
            samplesPerPixel: '1',
            stopToken,
            statusCallback: () => {},
          })
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
          }
        } finally {
          stopStopToken(stopToken)
          if (isAlive(self)) {
            self.setRunClustering(undefined)
          }
          applying = false
        }
      },
      { delay: 500, name: 'AutoRunMultiWiggleClustering' },
    ),
  )
}
