import {
  assertDisplayContract,
  makeRetryContractCheck,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import {
  createStopTokenRotation,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { leadingEdgeAutorun } from '@jbrowse/core/util/leadingEdgeAutorun'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'

import { renameRegionsForAdapter } from './renameRegionsForAdapter.ts'

import type {
  AssemblyManager,
  Region,
  RpcStatus,
  StopToken,
} from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface ComparativeFetchContext {
  adapterConfig: Record<string, unknown>
  sessionId: string
  stopToken: StopToken
  /** pre-gated on staleness; pass straight as the RPC `statusCallback` arg */
  statusCallback: (status: RpcStatus) => void
  /**
   * Canonical assembly refNames -> the adapter's own namespace (e.g. "1" ->
   * "NC_012119.1"). Every region the worker sees must go through this: it has
   * no assemblyManager, so it can't resolve aliases itself, and its getFeatures
   * query, its cumBp index and the feature refNames it reads back all have to
   * line up.
   */
  rename: (regions: Region[]) => Promise<Region[]>
  /** for the rare post-RPC resolution `rename` doesn't cover */
  assemblyManager: AssemblyManager
}

interface ComparativeFetchHost extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  /** `SyntenyFetchStateMixin`'s retry counter — see the read in the autorun */
  reloadCounter: number
  /**
   * `SyntenyFetchStateMixin`'s: the states where this display's fetch autorun
   * deliberately never runs, so a `prepare` declining in one of them is not the
   * dead Retry the check below hunts for. Same name and same meaning as
   * `FetchMixin.fetchInert` on the LGV side, which is what lets one check serve
   * all three fetch families.
   */
  fetchInert: boolean
  setError: (error?: unknown) => void
  setFetching: (fetching: boolean) => void
  setStatusMessage: (status?: RpcStatus) => void
}

/**
 * The shared fetch-trigger skeleton for the comparative displays (dotplot,
 * synteny): stop-token rotation, leading-edge debounce, loading/error flags,
 * refName reconciliation, and the latest-wins staleness discipline. A display
 * supplies only its own gate, RPC args and result handling.
 *
 * The three phases exist to make the staleness rules structural rather than
 * remembered, since getting any of them wrong strands the display:
 *
 * - `prepare` runs synchronously inside the autorun, so its reads — and only
 *   its reads — are the dependency set. Returning undefined skips the run
 *   (view not initialized, display minimized); the reads that decided that are
 *   still tracked, so the autorun rewakes. Prefer folding the fetch's inputs
 *   into one `currentFetchKey` computed over tracking them individually: a pan
 *   inside the buffered window then recomputes the same string and doesn't
 *   refire, and that same string tags the committed data so it can't drift
 *   from what was fetched even if the view moves again mid-RPC.
 * - `run` owns every await — the RPC and any post-RPC async derivation whose
 *   result the commit needs. Nothing it does writes to the model.
 * - `commit` is synchronous and runs only while this is still the latest
 *   fetch, so a superseded fetch resolving late can't clobber fresher data.
 *   Async work here would reopen exactly that window, which is why it isn't
 *   allowed to await.
 *
 * The `finally` clears the loading flags under the same staleness guard: an
 * abort raised while still current is the one exit neither commit nor the
 * error path covers, and it otherwise strands `fetching` true forever.
 */
export function installComparativeFetchAutorun<TArgs, TResult>(
  self: ComparativeFetchHost,
  {
    name,
    delay,
    prepare,
    run,
    commit,
  }: {
    name: string
    delay: number
    prepare: () => TArgs | undefined
    run: (args: TArgs, ctx: ComparativeFetchContext) => Promise<TResult>
    commit: (result: TResult, args: TArgs) => void
  },
) {
  // Dev-only, and the reason this call is here rather than in each comparative
  // display: the same contracts the other two fetch families check are checked
  // by whichever installer put the display's autoruns in, so a family that
  // grows its own skeleton does not also have to remember to ask.
  assertDisplayContract(self, `${name}'s installComparativeFetchAutorun`)
  // The other half of the same doctrine. This family is the one that shipped a
  // Retry without it: the `reloadCounter` read below guarantees `reload()`
  // re-RUNS the autorun, never that the run reaches a fetch, and after a
  // failure every fetch input is unchanged. See makeRetryContractCheck.
  const noteFetchAutorunRun = makeRetryContractCheck(self)

  const fetch = createStopTokenRotation(self, self)

  // The awaits live in here, not in the autorun body. An async autorun stops
  // tracking at its first await, so a read moved below one silently leaves the
  // dependency set — and every read that decides anything here is already above
  // the first await. Splitting says so structurally rather than by luck.
  async function runFetch(args: TArgs) {
    const { adapterConfig } = self
    const { stopToken, isCurrent, statusCallback, end } = fetch.begin()
    // clear any prior error as the new fetch begins, so a stale banner
    // never lingers over freshly-loaded data
    self.setError(undefined)
    self.setFetching(true)
    try {
      const sessionId = getRpcSessionId(self)
      const { assemblyManager } = getSession(self)
      const result = await run(args, {
        adapterConfig,
        sessionId,
        stopToken,
        statusCallback,
        assemblyManager,
        rename: regions =>
          renameRegionsForAdapter({
            assemblyManager,
            sessionId,
            adapterConfig,
            regions,
          }),
      })
      if (isCurrent()) {
        commit(result, args)
      }
    } catch (e) {
      if (isCurrent() && !isAbortException(e)) {
        console.error(e)
        self.setError(e)
      }
    } finally {
      // the fetching flag under the staleness guard, the status through
      // `end()` — which closes that guard, so it goes last
      if (isCurrent()) {
        self.setFetching(false)
      }
      end()
    }
  }

  leadingEdgeAutorun(
    self,
    function comparativeFetchAutorun() {
      // Tracked unconditionally, and BEFORE the `prepare()` bail-outs: after
      // an error every fetch input is unchanged, so `prepare` recomputes the
      // same key and nothing refires the autorun — `reload()` bumping this is
      // the only thing that can. Reading it here rather than inside each
      // display's `prepare` is what makes the error banner's Retry real for
      // both of them at once. (`void` because the value is never used; the
      // read is the point.)
      void self.reloadCounter
      // Teardown mutates observables `prepare` reads before the disposers
      // run, and getContainingView on a detached node warns then throws.
      const args = isAlive(self) ? prepare() : undefined
      if (args === undefined) {
        noteFetchAutorunRun('declined')
        return false
      }
      noteFetchAutorunRun('fetched')
      void runFetch(args)
      // arms the debounce; the runs `prepare` bails on (pre-init, minimized)
      // return false and stay on the leading edge, so the first real fetch is
      // immediate while zoom/pan refetches debounce
      return true
    },
    { name, delay },
  )

  addDisposer(self, () => {
    fetch.dispose()
  })
}
