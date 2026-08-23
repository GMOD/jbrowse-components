import {
  getContainingView,
  getNotificationSink,
  getRpcHost,
  getSession,
  locStringsToRegions,
} from '@jbrowse/core/util'
import { isAbortException } from '@jbrowse/core/util/aborting'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type {
  Region,
  RpcCaller,
  RpcStatus,
  StatusStream,
} from '@jbrowse/core/util'
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
// It is `openStatusStream` rather than `setStatusMessage` for the same reason
// the fetch path uses it: a clustering run is one of the display's concurrent
// operations, so it takes a slot on the field rather than writing it (ADR-081),
// and the throttle that keeps a per-iteration RPC progress stream from writing
// MST — and re-rendering the chip — on every callback lives there too. The extra
// `applying` gate is this path's own: the status channel is out-of-band from the
// call's return value, so a callback landing after the `finally` would otherwise
// set a status with no run behind it and pin the chip up for good.
export function setupRunClusteringAutorun(
  self: IStateTreeNode & {
    runClustering?: boolean
    // The locus the run reads from, if the session named one. Optional on the
    // type because a display can adopt the trigger without the region.
    clusterRegion?: string
    setRunClustering: (arg?: boolean) => void
    setClusterRegion?: (arg?: string) => void
    openStatusStream: (isCurrent: () => boolean) => StatusStream
  },
  opts: {
    name: string
    ready: () => boolean
    // Everything the flavor needs to make its RPC call, in one object.
    //
    // `regions` is what to cluster over: the display's `clusterRegion`
    // resolved, or the visible blocks. Handed down rather than left for each
    // flavor to read off the view, which is also why none of them takes the
    // view any more -- resolving the regions was the only thing they used it
    // for, and two of the three already ignored it.
    //
    // `rpcManager` / `sessionId` are here for the same reason one step later:
    // all three flavors opened with the identical `getRpcHost(self).rpcManager`
    // + `getRpcSessionId(self)` pair, which was the bulk of what each wrapper
    // module contained. Resolving them once also means a flavor cannot reach
    // for a *different* session id and silently land its RPC on another
    // worker's adapter cache.
    run: (args: {
      rpcManager: RpcCaller
      sessionId: string
      regions: Region[]
      stopToken: StopToken
      statusCallback: (status: RpcStatus) => void
    }) => Promise<void>
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
        // narrowed to this run rather than merely to the node being alive, so a
        // status arriving after the run settles can't repaint the chip.
        // Wrapping a callback in a second guarded sink said the same thing and
        // also stacked a second throttle window on the model-wide one, delaying
        // every status by up to two.
        const stream = self.openStatusStream(() => applying && isAlive(self))
        try {
          const regions = await clusterRegions(self, view)
          await opts.run({
            rpcManager: getRpcHost(self).rpcManager,
            sessionId: getRpcSessionId(self),
            regions,
            stopToken,
            statusCallback: stream.statusCallback,
          })
        } catch (e) {
          if (!isAbortException(e) && isAlive(self)) {
            console.error(e)
            // This path has no dialog to report into -- that is the whole
            // reason it owns a status channel -- so without this the only sign
            // of a failure is the progress chip disappearing and nothing
            // happening. A `clusterRegion` with a typo in it lands here, and it
            // is a setting the session author can fix.
            getNotificationSink(self).notifyError(`${e}`, e)
          }
        } finally {
          stopStopToken(stopToken)
          // this run's slot, retired: the display's viewport fetch may be
          // running beside it, and blanking the field outright took its label
          // with it (ADR-081)
          stream.clear()
          if (isAlive(self)) {
            // both halves of the trigger, since the region is its argument: a
            // saved session must not keep a locus that no run is coming for
            self.setRunClustering(undefined)
            self.setClusterRegion?.(undefined)
          }
          applying = false
        }
      },
      { delay: 500, name: opts.name },
    ),
  )
}

// The declared locus if there is one, else what is on screen. Resolved on the
// client because the assembly is what turns a locstring into a region, and only
// the client has one.
async function clusterRegions(
  self: IStateTreeNode & { clusterRegion?: string },
  view: LinearGenomeViewModel,
): Promise<Region[]> {
  const { clusterRegion } = self
  const assemblyName = view.assemblyNames[0]
  if (!clusterRegion || !assemblyName) {
    return view.dynamicBlocks.contentBlocks
  }
  // waitForAssembly, not `get`: the autorun can fire on the first ready tick,
  // before the assembly manager has finished loading refNames, and a locstring
  // cannot be validated without them
  const assembly =
    await getSession(self).assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  return locStringsToRegions(clusterRegion, assembly, assemblyName)
}
