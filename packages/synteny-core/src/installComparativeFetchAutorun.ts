import { getSession } from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { observable, runInAction } from 'mobx'

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
  /** `SyntenyFetchStateMixin`'s retry counter — the skeleton reads it */
  reloadCounter: number
  /**
   * `SyntenyFetchStateMixin`'s: the key the display's own `commit` stamps, and
   * what the skeleton's freshness gate compares a run's key against. The same
   * stamp `comparativeFetchFlags.dataCurrent` reads, so the two never disagree.
   */
  loadedFetchKey: string | undefined
  /** `SyntenyFetchStateMixin`'s durable user-cancel flag — the skeleton gates on it */
  fetchCanceled: boolean
  /**
   * `SyntenyFetchStateMixin`'s: the states where this display's fetch autorun
   * deliberately never runs, so a `prepare` declining in one of them is not the
   * dead Retry the skeleton's contract check hunts for. Same name and same
   * meaning as `FetchMixin.fetchInert` on the LGV side, which is what lets one
   * check serve all three fetch families.
   */
  fetchInert: boolean
  setError: (error?: unknown) => void
  setFetching: (fetching: boolean) => void
  setStatusMessage: (status?: RpcStatus) => void
  /**
   * Takes this installation's stop for `cancelFetchByUser` to call. The
   * rotation is a closure inside `installFetch` rather than a member here, and
   * a `fetchCanceled` the RPC outlives is not a cancel —
   * `SyntenyFetchStateMixin.stopActiveFetch` has the whole argument.
   */
  setStopActiveFetch: (stop: () => void) => void
}

/** what `prepare` captures, beside the display's own args */
interface ComparativeArgs<TArgs> {
  args: TArgs
  adapterConfig: Record<string, unknown>
}

/**
 * The comparative displays' (dotplot, synteny) spelling of the shared fetch
 * skeleton: `installFetch` owns the rotation, the leading-edge debounce, the
 * unconditional `reloadCounter` read, the durable cancel gate, the clear-at-start
 * rule and the latest-wins staleness discipline; this adds what is this family's
 * own — the `fetching` flag (ADR-054 keeps that split from `FetchMixin`'s
 * `activeStopToken`), and the richer context a `run` here is handed.
 *
 * The three phases are {@link FetchPhases}, the same contract the LGV global
 * family runs on, over this family's own context. The rules are there.
 *
 * **What the tracked half may read.** Two fetch-lifecycle observables are read
 * in the autorun body — `reloadCounter` and `fetchCanceled` — and both are safe
 * for the same reason: only a user gesture moves either one. Nothing
 * fetch-DERIVED may join them, `prepare` included, since it runs inside this
 * derivation. **`error` is the one that will be reached for**: the skeleton
 * clears it at the start of every fetch and sets it on failure, so a tracked
 * read of it turns a single failure into an unbounded retry loop — fetch, fail,
 * error changes, autorun refires — paced only by the debounce, against the
 * server that just failed. Same law as `installGlobalFetchAutorun`'s
 * "`rpcProps()` must never return fetch-derived state", and nothing checks
 * either one.
 *
 * `adapterConfig` is captured in `prepare` rather than read inside `run`,
 * because an adapter edited in the config editor has to refetch and `run`'s
 * reads are untracked by contract. It is read only on a run that reaches a
 * fetch, which is the dependency-set position it has always had. **It is also
 * an axis of the freshness key**, folded in here rather than into each
 * display's `fetchKey`: neither display's key carries an adapter term, so a
 * gate on `loadedFetchKey` alone would wake on the edit and decline against
 * it — the config editor silently stops refetching. The committed adapter is
 * this installer's own observable stamp; the key half is the mixin's.
 *
 * This family's cancel is durable until Retry, where the two LGV families' also
 * lapse on a viewport change: their viewport is an observable separate from the
 * fetch inputs, and here it *is* the fetch input, so the same clear would
 * un-cancel on every trigger — which is the durability this consolidation
 * rejected.
 */
export function installComparativeFetchAutorun<
  TArgs extends { fetchKey: string },
  TResult,
>(
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
  const committedAdapter = observable.box<string | undefined>()
  const cancel = installFetch<ComparativeArgs<TArgs>, TResult>(self, {
    name,
    delay,
    report: self,
    contract: `${name}'s installComparativeFetchAutorun`,
    fetchKey: ({ args, adapterConfig }) =>
      `${args.fetchKey}\n${JSON.stringify(adapterConfig)}`,
    committedKey: () =>
      self.loadedFetchKey === undefined
        ? undefined
        : `${self.loadedFetchKey}\n${committedAdapter.get()}`,
    prepare: () => {
      const args = prepare()
      return args === undefined
        ? undefined
        : { args, adapterConfig: self.adapterConfig }
    },
    run: ({ args, adapterConfig }, ctx) => {
      const sessionId = getRpcSessionId(self)
      const { assemblyManager } = getSession(self)
      return run(args, {
        ...ctx,
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
    },
    commit: (result, { args, adapterConfig }) => {
      runInAction(() => {
        commit(result, args)
        committedAdapter.set(JSON.stringify(adapterConfig))
      })
    },
    setError: error => {
      self.setError(error)
    },
    onBegin: () => {
      self.setFetching(true)
    },
    onEnd: current => {
      // under the staleness guard: a superseded run must not clear the flag the
      // run that replaced it just set
      if (current) {
        self.setFetching(false)
      }
    },
  })
  // The user-facing cancel, handed to the model because the rotation is the
  // skeleton's. Wrapped rather than passed by reference so `cancel` can never
  // be called with arguments it does not declare today.
  self.setStopActiveFetch(() => {
    cancel()
  })
}
