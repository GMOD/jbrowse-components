import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import {
  assertDisplayContract,
  makeRetryContractCheck,
} from '../pluggableElementTypes/models/assertDisplayContract.ts'
import { handleFetchError } from './aborting.ts'
import { createStopTokenRotation } from './createStopTokenRotation.ts'
import { makeFetchContext } from './fetchContext.ts'
import { leadingEdgeAutorun } from './leadingEdgeAutorun.ts'

import type { ActiveFetch, StatusReporter } from './createStopTokenRotation.ts'
import type { FetchContext } from './fetchContext.ts'
import type { FetchPhases } from './fetchPhases.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The bookkeeping a family hangs off one fetch, beside the phases. Each of the
 * five fetches in the tree fills a different subset, and that subset is the
 * only thing about them that genuinely differs.
 */
export interface FetchLifecycle {
  /**
   * Where the fetch's error lands, and the **clear-at-start rule** in the same
   * parameter: it is called with `undefined` the moment a run begins, so a
   * banner from a failed attempt cannot stand over the result a retriggered
   * run commits — a fetch re-fires on reads that never pass through `reload()`'s
   * own clear (an adapter edit, an un-minimize, a pan). One function rather
   * than a clear plus an `onError`, because a caller given two can supply one.
   *
   * A host with no error state of its own answers only the failure (the
   * breakpoint overlay raises a session notification), which is why the
   * argument is optional rather than the call being conditional.
   */
  setError: (error?: unknown) => void
  /**
   * Runs synchronously as the fetch starts, after the rotation has superseded
   * whatever it replaced: the loading flag (`FetchMixin`'s `activeStopToken`,
   * the comparative family's `fetching`), and anything a display blanks
   * because it has no freshness signature to keep stale data honest with
   * (chord's refName map).
   */
  onBegin?: (active: ActiveFetch) => void
  /**
   * Runs in the `finally`, before the rotation's `end()`. `current` is this
   * run's own guard, already evaluated: a **superseded** run must not clear the
   * loading flag the run that replaced it just set, and it is the only exit
   * that reaches here without having gone through either the commit or the
   * error path.
   */
  onEnd?: (current: boolean) => void
}

/**
 * One fetch, once: **begin → clear the error → run → commit if still current →
 * {@link handleFetchError} → end**.
 *
 * That sequence was written five times — `FetchMixin.runFetch`, the
 * prerequisite skeleton, the comparative installer, the circular view's chord
 * fetch and the breakpoint split view's overlay fetch — and each copy was
 * missing a different rule: no rotation at all, an error publish guarded on
 * liveness but not currency, no clear at the start, a `finally` that stranded
 * the loading flag on an abort. The rules only pay for themselves by being the
 * same everywhere, so they live here and the differences are parameters.
 *
 * `active` comes from a {@link createStopTokenRotation} `begin()` the caller
 * already made, because who owns the rotation is one of the real differences: a
 * display's *primary* fetch rotates through `FetchMixin`, so `cancelFetch` can
 * reach it, while every other fetch's rotation lives in its installer's closure
 * ({@link installFetch}).
 *
 * **Called synchronously by every caller**, so its own prefix down to the first
 * `await` — and `run`'s prefix with it — executes wherever the caller was.
 * `installFetch` puts that inside `untracked`; `FetchMixin.runFetch` is an MST
 * flow, and so an action, which MobX runs untracked already.
 */
export async function runFetchOnce<TArgs, TResult>(
  self: IStateTreeNode,
  active: ActiveFetch,
  args: TArgs,
  {
    run,
    commit,
    setError,
    onBegin,
    onEnd,
  }: Pick<FetchPhases<TArgs, TResult, FetchContext>, 'run' | 'commit'> &
    FetchLifecycle,
) {
  const { stopToken, isCurrent, statusCallback, end } = active
  // synchronous, so it lands while this run is by construction the current one
  setError(undefined)
  onBegin?.(active)
  try {
    const result = await run(
      args,
      makeFetchContext(self, {
        stopToken,
        isStale: () => !isCurrent(),
        statusCallback,
      }),
    )
    // `undefined` is "nothing to commit" — a pre-flight that stopped this
    // fetch — so it is not a result to record
    if (result !== undefined && isCurrent()) {
      commit(result, args)
    }
  } catch (e) {
    handleFetchError(e, isCurrent, setError)
  } finally {
    onEnd?.(isCurrent())
    // last, because it closes the guard `onEnd` reads, and unconditional
    // because a superseded run's status slot goes on voting for a phase that
    // is over until it is retired
    end()
  }
}

/**
 * The host members {@link installFetch}'s autorun body reads for itself, above
 * everything the family supplies.
 *
 * `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any`
 * and silently turns off checking for every member below.
 */
export interface FetchSkeletonHost extends IStateTreeNode {
  /**
   * The pure "go again" signal, read unconditionally above every gate. After a
   * failure every other fetch input is unchanged, so nothing but this can
   * rewake the body — and a read placed under a gate drops out of the
   * dependency set on the run that declines, which is a Retry button that
   * works until the first time it is needed.
   */
  reloadCounter: number
  /**
   * The states where this host deliberately fetches nothing, read only by the
   * dev-only retry check. A decline there is not a dead Retry.
   */
  fetchInert: boolean
  /**
   * A standing user cancel, and the one durability rule for all of them: **a
   * cancel is durable — no fetch trigger un-cancels it.** Read tracked, under
   * `reloadCounter` and above every other gate, so the gesture that reopens it
   * (Retry, or the LGV foundations' clear-on-viewport-change) is in the
   * dependency set of the run it closed.
   *
   * Optional because a host with no cancel affordance has no cancel to be
   * durable — the circular view's chord fetch and the breakpoint overlay fetch
   * offer no Cancel button, so they declare nothing rather than a constant
   * `false`.
   */
  fetchCanceled?: boolean
}

export interface InstallFetchOptions<TArgs, TResult>
  extends FetchPhases<TArgs, TResult, FetchContext>, FetchLifecycle {
  /** autorun name, for the MobX devtools/spy stream */
  name: string
  /** how long to coalesce reruns once the body has started work once */
  delay: number
  /**
   * Where this fetch's status lands. A display passes itself — its status
   * fields are part of its own API, and one composing `FetchMixin` lends the
   * model-wide window so this fetch takes a slot on the one field beside the
   * display's other operations rather than opening a second writer over it.
   * Anything with one operation to narrate passes a `createStatusChannel`.
   */
  report: StatusReporter
  /**
   * An extra skip above `prepare`, reported as `gated` rather than `declined`:
   * the skeleton decided before the family's own gate was consulted, so it is
   * not the dead Retry the contract check hunts for. Must be a *tracked* read
   * that flips on the transition to wake on — a minimized track, a view that
   * is not initialized.
   */
  gate?: () => boolean
  /**
   * Install the two dev-only display-contract checks under this name. Omitted
   * by a **secondary** fetch on a host whose primary foundation already
   * installed them: `assertDisplayContract` would report the second install as
   * the double-attach it is built to catch, and a second retry check would
   * consume the same `reloadCounter` bumps as the first.
   */
  contract?: string
}

/**
 * The two dev-only checks every fetch installer owes, together because they are
 * the same doctrine: one reports a foundation attached twice, the other reports
 * a `reload()` the gate still declines — the dead Retry button.
 */
function installContractChecks(self: FetchSkeletonHost, contract: string) {
  assertDisplayContract(self, contract)
  return makeRetryContractCheck(self)
}

/**
 * A whole fetch, installed: the rotation, the leading-edge autorun, the
 * unconditional trigger reads, the gates, and {@link runFetchOnce} under them.
 *
 * Every fetch in the tree is this shape except one — the prerequisite reads
 * (HiC's header, the multi-sample sample list), both comparative displays, the
 * circular view's chord fetch, the breakpoint overlay fetch and the multi-way
 * synteny display's two DEPENDENT fetches (lane genes, lane links, each gated on
 * the key its own commit stamps) all take it. The
 * exception is `FetchMixin.runFetch`, the viewport fetch of an LGV display: its
 * rotation is a member rather than a closure (so `cancelFetch` can reach it)
 * and its trigger list is the per-region or global foundation's, so it holds
 * `runFetchOnce` directly and the autorun above it is that foundation's.
 *
 * What a caller supplies is exactly what differs between them: which reads wake
 * it (`prepare`, plus `gate`), what a round trip commits, where the loading
 * flag lives (`onBegin` / `onEnd`) and where the status goes (`report`).
 *
 * Returns the rotation's `cancel`, for a family whose model owns the user-facing
 * Cancel button: the flag alone is not a cancel — nothing rotates the token, the
 * stopped RPC stays current, and it commits over the load the user just stopped.
 */
export function installFetch<TArgs, TResult>(
  self: FetchSkeletonHost,
  {
    name,
    delay,
    report,
    gate,
    contract,
    prepare,
    run,
    commit,
    setError,
    onBegin,
    onEnd,
  }: InstallFetchOptions<TArgs, TResult>,
) {
  const noteFetchAutorunRun =
    contract === undefined ? undefined : installContractChecks(self, contract)
  const rotation = createStopTokenRotation(self, report)
  addDisposer(self, () => {
    rotation.dispose()
  })

  leadingEdgeAutorun(
    self,
    // #region voidTracking
    () => {
      // the pure "go again" signal, read unconditionally above every gate so a
      // Retry click re-runs the body even when nothing else moved
      void self.reloadCounter
      // Tracked in the same breath and for the same reason, but the mirror
      // image: this one CLOSES the gate below, so a run that returned before
      // the counter read would drop the one observable that can reopen it and
      // Cancel would be a one-way door with a Retry button on it. Order, not
      // just position: counter first, then this, then the gates.
      const canceled = self.fetchCanceled === true
      if (canceled || gate?.() === false) {
        noteFetchAutorunRun?.('gated')
        return false
      }
      // Teardown mutates observables `prepare` reads before the disposers run,
      // and getContainingView on a detached node warns then throws.
      const args = isAlive(self) ? prepare() : undefined
      if (args === undefined) {
        noteFetchAutorunRun?.('declined')
        return false
      }
      noteFetchAutorunRun?.('fetched')
      // `run` is called synchronously, so its prefix down to its first await
      // executes in this derivation; `FetchPhases.run` promises those reads are
      // untracked, and unlike the MST flow the LGV side hides behind, nothing
      // here makes it so. Whatever the run needs tracked belongs in `prepare`.
      // eslint-disable-next-line no-restricted-syntax -- effect input: run's prefix reads are the fetch's, prepare is the trigger list
      untracked(() => {
        void runFetchOnce(self, rotation.begin(), args, {
          run,
          commit,
          setError,
          onBegin,
          onEnd,
        })
      })
      // arms the debounce; the runs that bail above return false and stay on
      // the leading edge, so the first real fetch is immediate while a
      // zoom/pan refetch debounces
      return true
    },
    // #endregion
    { name, delay },
  )

  return rotation.cancel
}
