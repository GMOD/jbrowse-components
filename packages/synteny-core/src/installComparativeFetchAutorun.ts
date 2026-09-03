import { getSession } from '@jbrowse/core/util'
import { installFetch } from '@jbrowse/core/util/installFetch'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { fetchMixinLifecycle } from '@jbrowse/display-kit/FetchMixin'

import { renameRegionsForAdapter } from './renameRegionsForAdapter.ts'

import type { AssemblyManager, Region } from '@jbrowse/core/util'
import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { FetchPhases } from '@jbrowse/core/util/fetchPhases'
import type { FetchSkeletonHost } from '@jbrowse/core/util/installFetch'
import type { KeyedFetchHost } from '@jbrowse/display-kit/KeyedFetchMixin'

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

/**
 * `KeyedFetchHost` is the rotation this family lends the skeleton, the
 * begin/end/error trio, and the freshness pair with the commit that stamps it;
 * `FetchSkeletonHost` the counter, the durable cancel and the inert hook the
 * skeleton reads above every gate. The adapter is what a `run` here is handed
 * beside the context.
 */
interface ComparativeFetchHost extends KeyedFetchHost, FetchSkeletonHost {
  adapterConfig: Record<string, unknown>
}

/** what `prepare` captures, beside the display's own args */
interface ComparativeIssue<TArgs> {
  args: TArgs
  key: string
  adapterConfig: Record<string, unknown>
}

/**
 * The comparative displays' (dotplot, synteny) declaration over the shared
 * fetch skeleton, the way `installGlobalFetchAutorun` is the LGV global
 * family's: `installFetch` owns the leading-edge debounce, the unconditional
 * `reloadCounter` read, the durable cancel gate, the freshness gate with its
 * reload override, the clear-at-start rule, the latest-wins staleness
 * discipline and both contract checks; `FetchMixin` lends its rotation, so
 * `cancelFetchByUser` reaches the fetch this installs, and its begin/end/error
 * bookkeeping; `KeyedFetchMixin` supplies the key and the commit that stamps
 * it. What is this family's own is the richer context a `run` is handed — the
 * adapter config and the refName rename — and one deliberate absence.
 *
 * **The absence is the viewport-change clear.** Both LGV installers lapse a
 * user cancel when the view moves (`ClearBlockingStateOnViewportChange`,
 * `ClearCancelOnViewportChange`), because their viewport is an observable
 * separate from the fetch inputs. Here the viewport *is* the fetch input, so
 * the same clear would un-cancel on every trigger — and these displays sit on
 * single RPCs that can run for minutes against a remote index, where a cancel
 * any pan quietly undoes is not a cancel and a retry that re-arms itself
 * hammers the server that just failed. The gate holds until `reload()`, which
 * is the overlay's Retry button and nothing else.
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
 * **The freshness key is `currentFetchKey`, read here and stamped here.** The
 * display's `viewSignature` plus the settings and adapter axes, read tracked in
 * `prepare` (so an adapter edited in the config editor refetches the way a zoom
 * does; `run`'s reads are untracked by contract), stamped onto `loadedFetchKey`
 * by `commitFetchResult` in the same transaction as the display's own store,
 * and compared by `dataCurrent` — one key, one stamp, so the fetch gate and the
 * export gate cannot disagree on which axes a fetch has. A display's `prepare`
 * and `commit` never see the key.
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
  installFetch<ComparativeIssue<TArgs>, TResult>(self, {
    name,
    delay,
    rotation: self.fetchRotation,
    contract: `${name}'s installComparativeFetchAutorun`,
    fetchKey: ({ key }) => key,
    loadedKey: () => self.loadedFetchKey,
    // The display's `prepare` first, the key second: both displays gate on
    // the view being initialized inside `prepare`, and their `viewSignature`
    // reads view geometry that throws before it is — so the key is read only
    // once the gate is open, where the global family reads it first because
    // its `viewSignature` answers `undefined` for the same state.
    prepare: () => {
      const args = prepare()
      const key = args === undefined ? undefined : self.currentFetchKey
      return args === undefined || key === undefined
        ? undefined
        : { args, key, adapterConfig: self.adapterConfig }
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
    commit: (result, { args, key }) => {
      self.commitFetchResult(() => {
        commit(result, args)
      }, key)
    },
    ...fetchMixinLifecycle(self),
  })
}
