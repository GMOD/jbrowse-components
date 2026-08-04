import { getContainingView } from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Declarative counterpart to a "Cluster ..." -> "Run clustering" dialog,
// following the same transient-launch-spec pattern as LinearGenomeView's
// `init`: a session/config sets `runClustering: true` on the display, the real
// clustering RPC runs once automatically as soon as the display is ready, and
// the flag clears itself afterward (setRunClustering(undefined)) so a saved
// session never re-triggers it. Shared by the multi-sample variant, multi-wiggle
// and multi-row feature displays: each supplies its own `ready` gate and `run`
// (the actual RPC), while this owns the re-entrancy guard, the view.initialized
// gate, the stopToken lifecycle, and the status channel. `ready` and `run`'s
// dependency reads happen synchronously before the first await, so MobX tracks
// them and the autorun re-fires when sources arrive or the view initializes.
//
// `run` gets a `statusCallback` to hand the RPC. It writes the display's
// `statusMessage`/`statusProgress`, which `DisplayChrome` shows as a corner
// progress chip — this path has no dialog to report into, and a cohort-sized
// cluster is many seconds of otherwise invisible work. Owned here rather than
// per flavor so none of them can forget the clear (a status left set outlives
// the run and pins the chip up).
//
// It is `makeStatusCallback` rather than `setStatusMessage` for the same reason
// the fetch path uses it: the throttle that keeps a per-iteration RPC progress
// stream from writing MST (and re-rendering the chip) on every callback lives
// there, and `setStatusMessage` is deliberately unthrottled. The extra
// `applying` gate is this path's own: the status channel is out-of-band from the
// call's return value, so a callback landing after the `finally` would otherwise
// set a status with no run behind it and pin the chip up for good.
export function setupRunClusteringAutorun(
  self: IStateTreeNode & {
    runClustering?: boolean
    setRunClustering: (arg?: boolean) => void
    setStatusMessage: (status?: RpcStatus) => void
    makeStatusCallback: () => (status: RpcStatus) => void
  },
  opts: {
    name: string
    ready: () => boolean
    run: (
      view: LinearGenomeViewModel,
      stopToken: StopToken,
      statusCallback: (status: RpcStatus) => void,
    ) => Promise<void>
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
        const report = self.makeStatusCallback()
        try {
          await opts.run(view, stopToken, status => {
            if (applying) {
              report(status)
            }
          })
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
          }
        } finally {
          stopStopToken(stopToken)
          if (isAlive(self)) {
            self.setStatusMessage(undefined)
            self.setRunClustering(undefined)
          }
          applying = false
        }
      },
      { delay: 500, name: opts.name },
    ),
  )
}
