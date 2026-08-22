import { createStopTokenRotation, handleFetchError } from '@jbrowse/core/util'
import { leadingEdgeAutorun } from '@jbrowse/core/util/leadingEdgeAutorun'
import { addDisposer } from '@jbrowse/mobx-state-tree'

import { makeFetchContext } from './FetchMixin.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { ActiveFetch, RpcStatus, StatusWindow } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// `IStateTreeNode`, never `IAnyStateTreeNode` — the latter resolves to `any`
// and silently turns off checking for every member below.
interface PrerequisiteFetchHost extends IStateTreeNode {
  isMinimized: boolean
  reloadCounter: number
  setError: (e?: unknown) => void
  setStatusMessage: (status?: RpcStatus) => void
  // Lent to the rotation so this fetch takes a slot on the display's one
  // status field beside the viewport fetch, rather than opening a second
  // window over it (ADR-081).
  statusWindow: StatusWindow
}

/**
 * The skeleton for a display's *prerequisite* fetch: a second, non-viewport
 * fetch — a file header, a sample list — whose result the main fetch waits on
 * (`awaitingPrerequisite`). One shot per adapter rather than per viewport, so
 * it runs in its own autorun outside `FetchMixin.runFetch` (watching
 * `fetchGeneration` would refetch it on every viewport change), and exactly
 * because it is outside, each display used to re-spell the rules the shared
 * machinery holds elsewhere — and each copy was missing one:
 *
 * - **latest-wins**: `createStopTokenRotation`, so a reload-overlapped pair of
 *   runs cannot commit last-lands-wins (HiC's header read had no rotation at
 *   all);
 * - **the error rule**: `handleFetchError` — only a *current* run's real
 *   failure is logged and published, so a superseded run's teardown cannot
 *   overwrite the error slot its successor owns (the sources fetch's catch
 *   checked liveness but not currency);
 * - **the clear-at-start rule**: a run that starts clears the stale error, as
 *   `FetchMixin.runFetch` and the comparative `runFetch` do, so a banner from
 *   a failed attempt cannot stand over the result a retriggered run commits —
 *   this runner re-fires on tracked reads (`adapterConfig`, un-minimize) that
 *   never pass through `reload()`'s own clear;
 * - **the trigger list**: `reloadCounter` read unconditionally, above every
 *   gate, so Retry always re-runs the body;
 * - **the leading edge**: `leadingEdgeAutorun`, so the first run does not
 *   spend the whole debounce window on a cold open — this fetch is what first
 *   paint waits on.
 *
 * `run` owns the RPC — through `ctx.callRpc`, the same envelope every fetch
 * context carries — and returns the value to commit, or `undefined` for
 * "nothing"; its synchronous prefix runs inside the autorun body, so what it
 * reads to build the call (`adapterConfig`) is tracked and re-fires the fetch.
 * `commit` runs only while the run is still current; a resolved-but-unusable
 * result (HiC's empty binsize list) is `commit`'s own call to `setError`.
 * `enabled` is an optional extra gate and must be a *tracked* read that flips
 * on the transition to wake on (`view.initialized` is the in-tree case).
 *
 * `onError` replaces the default `setError`, for the display whose failure has
 * a second consequence — the sources scan raises a session notification too,
 * because a sample list that will not load leaves the band empty rather than
 * partial and nothing else on screen would say so. It runs inside
 * `handleFetchError`, so a superseded run's teardown cannot raise it either.
 */
export function installPrerequisiteFetch<T>(
  self: PrerequisiteFetchHost,
  opts: {
    run: (ctx: FetchContext) => Promise<T | undefined>
    commit: (result: T) => void
    name: string
    delay: number
    enabled?: () => boolean
    onError?: (error: unknown) => void
  },
) {
  const rotation = createStopTokenRotation(self, self)
  addDisposer(self, () => {
    rotation.dispose()
  })
  // Called synchronously from the autorun body, so `opts.run`'s own prefix
  // down to its first await is tracked; everything after an await is not, the
  // same split every fetch family arranges.
  const runOne = async ({
    stopToken,
    isCurrent,
    statusCallback,
    end,
  }: ActiveFetch) => {
    // synchronous, so it lands while this run is by construction the current
    // one — the clear-at-start rule above
    self.setError(undefined)
    try {
      const result = await opts.run(
        makeFetchContext(self, {
          stopToken,
          isStale: () => !isCurrent(),
          statusCallback,
        }),
      )
      if (result !== undefined && isCurrent()) {
        opts.commit(result)
      }
    } catch (e) {
      handleFetchError(e, isCurrent, err => {
        if (opts.onError) {
          opts.onError(err)
        } else {
          self.setError(err)
        }
      })
    } finally {
      end()
    }
  }
  leadingEdgeAutorun(
    self,
    // #region voidTracking
    () => {
      // the pure "go again" signal, read unconditionally above the gates so a
      // Retry click re-runs the body even when nothing else moved
      void self.reloadCounter
      if (self.isMinimized || opts.enabled?.() === false) {
        return false
      }
      void runOne(rotation.begin())
      return true
    },
    // #endregion
    { name: opts.name, delay: opts.delay },
  )
}
