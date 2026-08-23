import {
  assertDisplayContract,
  makeRetryContractCheck,
} from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import {
  createStopTokenRotation,
  getSession,
  handleFetchError,
} from '@jbrowse/core/util'
import { makeFetchContext } from '@jbrowse/core/util/fetchContext'
import { leadingEdgeAutorun } from '@jbrowse/core/util/leadingEdgeAutorun'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { renameRegionsForAdapter } from './renameRegionsForAdapter.ts'

import type { AssemblyManager, Region, RpcStatus } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { FetchPhases } from '@jbrowse/core/util/fetchPhases'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface ComparativeFetchContext extends FetchContext {
  adapterConfig: Record<string, unknown>
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
   * `SyntenyFetchStateMixin`'s durable user-cancel flag — see the gate in the
   * autorun, and `setStopActiveFetch` below for the other half of the cancel.
   */
  fetchCanceled: boolean
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
  /**
   * Takes this installation's stop for `cancelFetchByUser` to call. The
   * rotation is a closure here rather than a member there, and a `fetchCanceled`
   * the RPC outlives is not a cancel — `SyntenyFetchStateMixin.stopActiveFetch`
   * has the whole argument.
   */
  setStopActiveFetch: (stop: () => void) => void
}

/**
 * The shared fetch-trigger skeleton for the comparative displays (dotplot,
 * synteny): stop-token rotation, leading-edge debounce, loading/error flags,
 * refName reconciliation, and the latest-wins staleness discipline. A display
 * supplies only its own gate, RPC args and result handling.
 *
 * The three phases are {@link FetchPhases}, the same contract the LGV global
 * family runs on, over this family's own context. The rules are there.
 *
 * The `finally` clears the loading flags under the same staleness guard: an
 * abort raised while still current is the one exit neither commit nor the
 * error path covers, and it otherwise strands `fetching` true forever.
 *
 * **What the tracked half may read.** Two fetch-lifecycle observables are read
 * in the autorun body — `reloadCounter` and `fetchCanceled` — and both are safe
 * for the same reason: only a user gesture moves either one. Nothing
 * fetch-DERIVED may join them, `prepare` included, since it runs inside this
 * derivation. **`error` is the one that will be reached for**: this skeleton
 * clears it at the start of every fetch and sets it on failure, so a tracked
 * read of it turns a single failure into an unbounded retry loop — fetch, fail,
 * error changes, autorun refires — paced only by the debounce, against the
 * server that just failed. Same law as `installGlobalFetchAutorun`'s
 * "`rpcProps()` must never return fetch-derived state", and nothing checks
 * either one.
 *
 * That is also why this family has **no** clear-the-cancel-on-viewport-change
 * autorun, unlike the LGV per-region one: a comparative cancel is durable until
 * Retry (`SyntenyFetchStateMixin.fetchCanceled`). If one is ever added, note
 * that the LGV twin reads `fetchCanceled || error` inside `untracked`
 * deliberately — that autorun is undelayed, so the same loop there is
 * synchronous.
 */
export function installComparativeFetchAutorun<TArgs, TResult>(
  self: ComparativeFetchHost,
  {
    name,
    delay,
    prepare,
    run,
    commit,
  }: FetchPhases<TArgs, TResult, ComparativeFetchContext> & {
    name: string
    delay: number
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
  // The user-facing cancel, handed to the model because the rotation is here.
  // Wrapped rather than passed by reference so `cancel` can never be called
  // with arguments it does not declare today.
  self.setStopActiveFetch(() => {
    fetch.cancel()
  })

  // The awaits live in here, not in the autorun body. An async autorun stops
  // tracking at its first await, so a read moved below one silently leaves the
  // dependency set — and every read that decides anything here is already above
  // the first await. Splitting says so structurally rather than by luck.
  //
  // Called from inside `untracked`, and that is the half the split alone does
  // NOT give you: this is async but unawaited, so everything down to its first
  // await — this prefix, and `run`'s own prefix — still executes inside the
  // autorun's derivation. `FetchPhases.run` promises those reads are untracked,
  // and on the LGV side they are for free (`FetchMixin.runFetch` is an MST flow,
  // so an action, so untracked). Here nothing made it so: a `run` reading an
  // observable above its first await widened the dependency set and refetched.
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
      const result: TResult | undefined = await run(args, {
        ...makeFetchContext(self, {
          stopToken,
          isStale: () => !isCurrent(),
          statusCallback,
        }),
        adapterConfig,
        assemblyManager,
        rename: regions =>
          renameRegionsForAdapter({
            assemblyManager,
            sessionId,
            adapterConfig,
            regions,
          }),
      })
      // `undefined` is "nothing to commit" — a pre-flight that stopped this
      // fetch — so it is not a result to record. Neither display returns one
      // today; the contract is shared, so the guard is too.
      if (result !== undefined && isCurrent()) {
        commit(result, args)
      }
    } catch (e) {
      handleFetchError(e, isCurrent, err => {
        self.setError(err)
      })
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
      // Tracked in the same breath and for the same reason, but this one is the
      // mirror image: it CLOSES the gate below. Read it under the counter and
      // above every bail-out — a run that returned before the counter read
      // would drop the one observable that can reopen the gate out of the
      // dependency set, and Cancel would be a one-way door with a Retry button
      // on it. Order, not just position: counter first, then this, then gate.
      const canceled = self.fetchCanceled
      if (canceled) {
        // 'gated', not 'declined': the skeleton skipped this run before the
        // display's own `prepare` was consulted, and the overlay standing over
        // it is offering Retry rather than pretending to load.
        noteFetchAutorunRun('gated')
        return false
      }
      // Teardown mutates observables `prepare` reads before the disposers
      // run, and getContainingView on a detached node warns then throws.
      const args = isAlive(self) ? prepare() : undefined
      if (args === undefined) {
        noteFetchAutorunRun('declined')
        return false
      }
      noteFetchAutorunRun('fetched')
      // Tracked deliberately, and the one read of it that survives the
      // `untracked` below: an adapter edited in the config editor has to
      // refetch. In the same position it was in — inside `runFetch`, reached
      // only on a run that fetches — so the dependency set is unchanged.
      void self.adapterConfig
      untracked(() => {
        void runFetch(args)
      })
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
