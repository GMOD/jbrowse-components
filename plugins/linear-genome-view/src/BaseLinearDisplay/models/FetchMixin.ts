import {
  aggregateStatus,
  isAbortException,
  statusFraction,
  statusMessageText,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface FetchContext {
  stopToken: StopToken
  isStale: () => boolean
}

// Cancel-safe fetch lifecycle for any display that loads data over RPC.
//
// The mixin owns the entire fetch state machine (stop-token rotation,
// staleness tracking, error capture, status reporting). Consumers see
// only the high-level operations:
//
//   self.runFetch(work)   — start a cancellable fetch; cancels any prior.
//                           Implemented as an MST flow so post-await
//                           mutations stay inside the action context.
//   self.cancelFetch()       — cancel any in-flight fetch and bump
//                              fetchGeneration so observers re-evaluate.
//   self.isLoading           — true while a fetch is active.
//   self.error               — last non-abort error (or undefined).
//   self.statusMessage       — work-in-progress status string.
//   self.fetchGeneration     — see below.
//
// fetchGeneration bumps once at every fetch END (success, error, or cancel).
// Autoruns read `void self.fetchGeneration` to re-evaluate after a fetch completes;
// isLoading is not used as a dependency to avoid an extra fire on fetch start.
// The counter also serves as the staleness epoch in runFetch: captured at start,
// so a cancelFetch() bump makes isStale() return true in the in-flight flow.
//
// Composed by both per-region (MultiRegionDisplayMixin) and single-data
// (GlobalDataDisplayMixin) families.
/**
 * #stateModel FetchMixin
 * #category display
 *
 * Cancel-safe fetch lifecycle for any display that loads data over RPC. Owns
 * the entire fetch state machine (stop-token rotation, staleness tracking,
 * error capture, status reporting); consumers see only `runFetch`,
 * `cancelFetch`, `isLoading`, `error`, `statusMessage`, and `fetchGeneration`.
 */
export default function FetchMixin() {
  return types
    .model('FetchMixin', {})
    .volatile(() => ({
      /**
       * #volatile
       * stop token of the in-flight fetch, or undefined when idle
       */
      activeStopToken: undefined as StopToken | undefined,
      /**
       * #volatile
       * bumps at every fetch end; autoruns read it to re-evaluate, and it
       * doubles as the staleness epoch inside runFetch
       */
      fetchGeneration: 0,

      /**
       * #volatile
       * last non-abort fetch error, or undefined
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,

      /**
       * #volatile
       * work-in-progress status string
       */
      statusMessage: undefined as string | undefined,

      /**
       * #volatile
       * determinate progress fraction [0,1] for the current status, or
       * undefined when the in-flight phase is indeterminate
       */
      statusProgress: undefined as number | undefined,

      /**
       * #volatile
       * true after the user explicitly cancels a load (the loading overlay's
       * cancel button → `cancelFetchByUser`). A durable, blocking state — unlike
       * `cancelFetch`, it does not retrigger the fetch autoruns — so the load
       * stays stopped until the user retries (`reload`) or the viewport changes.
       * Any new fetch clears it (`runFetch` resets it at the start).
       */
      fetchCanceled: false,

      /**
       * #volatile
       * latest status of each concurrent in-flight operation, keyed by an
       * arbitrary id (the canvas display uses displayedRegionIndex). Plain
       * bookkeeping — not read reactively; setRegionStatus derives the
       * observable statusMessage/statusProgress from it on every update so N
       * parallel region fetches aggregate into one bar instead of clobbering.
       */
      regionStatuses: new Map<number, RpcStatus>(),
    }))
    .views(self => ({
      /**
       * #getter
       * true while a fetch is active
       */
      get isLoading() {
        return self.activeStopToken !== undefined
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      setStatusMessage(status?: RpcStatus) {
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
      },
      /**
       * #action
       * Drop the active stop token and clear all status bookkeeping. Shared by
       * both cancel paths and runFetch's cleanup.
       */
      resetStatus() {
        self.activeStopToken = undefined
        self.statusMessage = undefined
        self.statusProgress = undefined
        self.regionStatuses.clear()
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Record one concurrent operation's latest status (keyed) and recompute
       * the shared statusMessage/statusProgress as the aggregate across all
       * in-flight keys. Pass undefined to drop a key. Used by displays that fan
       * a single fetch out into parallel per-region RPCs.
       */
      setRegionStatus(key: number, status?: RpcStatus) {
        if (status === undefined) {
          self.regionStatuses.delete(key)
        } else {
          self.regionStatuses.set(key, status)
        }
        self.setStatusMessage(
          aggregateStatus([...self.regionStatuses.values()]),
        )
      },
      /**
       * #action
       * cancel any in-flight fetch and bump fetchGeneration (always bumps, so
       * callers can retrigger fetch autoruns even when nothing was in flight).
       * This is the *internal* reset used by clearAllRpcData/invalidateLoadedRegions
       * — it clears any user-cancel flag so the retrigger actually re-fetches.
       */
      cancelFetch() {
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
          self.resetStatus()
        }
        self.fetchCanceled = false
        self.fetchGeneration++
      },
      /**
       * #action
       * User-initiated cancel from the loading overlay. Stops the in-flight
       * fetch and lands in a durable `fetchCanceled` state. Unlike
       * `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns
       * don't immediately restart the load. The user retries via `reload`
       * (the overlay's retry button), or it clears on the next viewport change.
       */
      cancelFetchByUser() {
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
          self.resetStatus()
        }
        self.fetchCanceled = true
      },
      /**
       * #action
       * Run a cancel-safe fetch (cancels any prior). The work callback gets a
       * FetchContext with a stopToken to forward to the RPC and an isStale()
       * check to short-circuit commits once the user has moved on. Abort
       * errors are swallowed; others are stored in `error` if not stale.
       */
      runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
        }
        const stopToken = createStopToken()
        const gen = self.fetchGeneration
        self.activeStopToken = stopToken
        self.error = undefined
        // a load is starting, so the display is no longer in a user-canceled
        // state — this is the single clear point that covers every retrigger
        // path (reload, viewport change, settings invalidate)
        self.fetchCanceled = false

        const isStale = () =>
          !isAlive(self) ||
          self.fetchGeneration !== gen ||
          self.activeStopToken !== stopToken

        try {
          yield work({ stopToken, isStale })
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Fetch failed:', e)
            if (!isStale()) {
              self.error = e
            }
          }
        } finally {
          if (!isStale()) {
            self.resetStatus()
            self.fetchGeneration++
          }
        }
      }),
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
