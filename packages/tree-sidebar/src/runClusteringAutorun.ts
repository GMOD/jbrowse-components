import { getContainingView } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Declarative counterpart to a "Cluster ..." -> "Run clustering" dialog,
// following the same transient-launch-spec pattern as LinearGenomeView's
// `init`: a session/config sets `runClustering: true` on the display, the real
// clustering RPC runs once automatically as soon as the display is ready, and
// the flag clears itself afterward (setRunClustering(undefined)) so a saved
// session never re-triggers it. Shared by the multi-sample variant and
// multi-wiggle displays: each supplies its own `ready` gate and `run` (the
// actual RPC), while this owns the re-entrancy guard, the view.initialized
// gate, and the stopToken lifecycle. `ready` and `run`'s dependency reads
// happen synchronously before the first await, so MobX tracks them and the
// autorun re-fires when sources arrive or the view initializes.
export function setupRunClusteringAutorun(
  self: IAnyStateTreeNode & {
    runClustering?: boolean
    setRunClustering: (arg?: boolean) => void
  },
  opts: {
    name: string
    ready: () => boolean
    run: (view: LinearGenomeViewModel, stopToken: StopToken) => Promise<void>
  },
) {
  // Plain closure flag (not observable) guards re-entrant runs while the RPC is
  // in flight, the same trick setupInitAutorun uses for `init`.
  let applying = false
  addDisposer(
    self,
    autorun(
      async () => {
        if (!self.runClustering || applying || !opts.ready()) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        applying = true
        const stopToken = createStopToken()
        try {
          await opts.run(view, stopToken)
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
      { delay: 500, name: opts.name },
    ),
  )
}
