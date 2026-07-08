import { getContainingView, getSession } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { runGenotypeClustering } from './runGenotypeClustering.ts'

import type { ReducedModel } from './components/MultiSampleVariantClusterDialog/types.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Declarative counterpart to the "Cluster by genotype" -> "Run clustering"
// dialog, following the same transient-launch-spec pattern as
// LinearGenomeView's `init`: a session/config sets `runClustering: true` on
// the display, the real clustering RPC runs once automatically, and the flag
// is cleared afterwards (setRunClustering(undefined)) so a saved session never
// re-triggers it.
export function getMultiSampleVariantClusterAutorun(
  self: IAnyStateTreeNode &
    ReducedModel & {
      runClustering?: boolean
      setRunClustering: (arg?: boolean) => void
      setStatusMessage: (status?: RpcStatus) => void
    },
) {
  // Plain closure flag (not observable) guards re-entrant runs while the RPC
  // is in flight, the same trick setupInitAutorun uses for `init`.
  let applying = false
  addDisposer(
    self,
    autorun(
      async () => {
        const { runClustering, sourcesVolatile } = self
        if (!runClustering || applying || !sourcesVolatile) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        applying = true
        const stopToken = createStopToken()
        try {
          await runGenotypeClustering({
            model: self,
            rpcManager: getSession(self).rpcManager,
            sessionId: getRpcSessionId(self),
            regions: view.dynamicBlocks.contentBlocks,
            stopToken,
            statusCallback: self.setStatusMessage,
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
      { delay: 500, name: 'AutoRunMultiSampleVariantClustering' },
    ),
  )
}
