import {
  aggregateStatus,
  createGuardedStatusSink,
  createStatusThrottle,
  isAbortException,
  statusFraction,
  statusMessageText,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'

import type { RpcStatus, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface FetchContext {
  stopToken: StopToken
  isStale: () => boolean
  /**
   * This display's RPC `statusCallback`, guarded and throttled — the same thing
   * `makeStatusCallback()` returns, carried on the context so a helper that
   * only ever receives a `ctx` (`byteGateBlocksFetch`, `fetchEachRegion`) can
   * report progress without reaching back into the model for it.
   */
  statusCallback: StatusCallback
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

      // error / statusMessage / statusProgress below duplicate BaseDisplay's,
      // so this mixin composes standalone (its own tests) as well as onto a
      // display. In a real composition one set wins — which is exactly why the
      // throttle policy lives in the shared `createStatusThrottle` and not in
      // either `setStatusMessage` body. Don't "fix" the duplication by
      // extracting a mixin: see ADR-041, the compose layer breaks type
      // inference in unrelated display chains.

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
    .views(self => ({
      /**
       * #getter
       * `isLoading` widened to cover a user-canceled load. **This, not
       * `isLoading`, is what a `displayPhase` loading term wants.**
       * `cancelFetchByUser` clears the stop token synchronously, so `isLoading`
       * goes false the instant the user clicks Cancel — and the loading overlay
       * that unmounts on it is carrying the Retry button, which is the only way
       * back: the state is deliberately durable, so no autorun restarts the
       * fetch on its own. A bare `isLoading` therefore reads as `ready` over a
       * display that is stopped, empty and offering nothing.
       *
       * Arc read `isLoading` directly and had exactly that hole. It is a getter
       * here so no family has to remember the second term.
       */
      get isLoadingOrCanceled() {
        return self.isLoading || self.fetchCanceled
      },

      /**
       * #getter
       * Overridable hook (default false): a subclass returns true when its body
       * is deliberately showing a static message instead of data, so the loading
       * scrim must not cover it. Sequence sets it past base resolution ("Zoom in
       * to see sequence"); LD sets it with the triangle toggled off.
       *
       * A hook rather than a `displayPhase` override, because overriding the
       * getter means restating the whole loading condition — which is how
       * sequence came to hold a verbatim copy of the other terms, one `git blame`
       * away from silently missing the next one added.
       *
       * It lives **here** because this is the one mixin all three display
       * foundations compose. On `MultiRegionDisplayMixin` it was reachable by
       * one of the three, so the global family hard-coded `false` and LD could
       * express only the half `rendersCanvas` reaches — which drops the
       * pre-first-paint term alone and leaves the scrim free to park over the
       * placeholder on the durable cancel term. Same argument, one level down,
       * that put `rendersCanvas` on `RenderLifecycleMixin` beside `canvasDrawn`.
       */
      get loadingSuppressed(): boolean {
        return false
      },
    }))
    .actions(self => {
      // One window per display instance, shared by both callback factories
      // below, so N parallel per-region fetches thin to one stream between them
      // rather than N. The shared primitive is also what the non-mixin fetches
      // (dotplot, synteny, via createStopTokenRotation) use.
      const throttle = createStatusThrottle()
      return {
        /**
         * #action
         */
        setError(error?: unknown) {
          self.error = error
        },
        /**
         * #action
         * Unthrottled: a display writing a phase label by hand must see every
         * write land. The high-frequency RPC stream is thinned one level up, in
         * the callback factories.
         */
        setStatusMessage(status?: RpcStatus) {
          self.statusMessage = statusMessageText(status)
          self.statusProgress = statusFraction(status)
        },
        /**
         * #action
         * Run `apply` only if the throttle window has elapsed.
         */
        throttleStatus(apply: () => void) {
          throttle.run(apply)
        },
        /**
         * #action
         * Drop the active stop token and clear all status bookkeeping. Shared by
         * both cancel paths and runFetch's cleanup.
         */
        resetStatus() {
          throttle.reset()
          self.activeStopToken = undefined
          self.statusMessage = undefined
          self.statusProgress = undefined
          self.regionStatuses.clear()
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Abort the in-flight fetch (if any) and clear its status. The shared
       * preamble of both cancel paths; the difference between them is only what
       * they do to `fetchCanceled` / `fetchGeneration` afterward.
       */
      stopActiveFetch() {
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
          self.resetStatus()
        }
      },
      /**
       * #action
       * An RPC `statusCallback` bound to this display: forwards progress to the
       * shared `statusMessage`, guarded so a callback that fires after the node
       * is torn down (RPCs resolve their status stream asynchronously) is a safe
       * no-op, and throttled through the display-wide window. Pass directly as
       * the `statusCallback` RPC arg instead of re-inlining the guard at every
       * call site.
       *
       * `isCurrent` narrows that guard. It defaults to "the node is alive",
       * which is all a caller holding only the model can check; `runFetch`
       * passes `!isStale()` so the context's callback is scoped to its own
       * fetch and a superseded one cannot repaint the overlay of the fetch that
       * replaced it.
       *
       * Declared this early only so `runFetch` can put one on every
       * `FetchContext`; its sibling `makeRegionStatusCallback` needs
       * `setRegionStatus` and so stays below.
       */
      makeStatusCallback(isCurrent: () => boolean = () => isAlive(self)) {
        return createGuardedStatusSink({
          isCurrent,
          sink: status => {
            self.setStatusMessage(status)
          },
          // the model-wide window, so N of these thin to one stream between them
          throttle: {
            run: apply => {
              self.throttleStatus(apply)
            },
          },
        })
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
        // The map update above is unconditional and only this derived write is
        // thinned. Throttling the whole call — as the caller used to — dropped
        // `undefined` deletes too, stranding a finished region in the aggregate
        // for the rest of the fetch. A cleared aggregate (every region done)
        // also bypasses the throttle, or a finished fetch's message would stay
        // on screen.
        const aggregate = aggregateStatus([...self.regionStatuses.values()])
        if (aggregate === undefined) {
          self.setStatusMessage(undefined)
        } else {
          self.throttleStatus(() => {
            self.setStatusMessage(aggregate)
          })
        }
      },
      /**
       * #action
       * cancel any in-flight fetch and bump fetchGeneration (always bumps, so
       * callers can retrigger fetch autoruns even when nothing was in flight).
       * This is the *internal* reset `clearAllRpcData` runs — it clears any
       * user-cancel flag so the retrigger actually re-fetches.
       */
      cancelFetch() {
        self.stopActiveFetch()
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
        self.stopActiveFetch()
        self.fetchCanceled = true
      },
      /**
       * #action
       * Release an in-flight fetch's stop token on teardown. Without this, a
       * display destroyed mid-fetch (track/view closed while loading) never
       * signals the worker to abort the now-useless work, and its in-flight HTTP
       * reads keep downloading. MST auto-chains lifecycle hooks, so a composing
       * display can still define its own beforeDestroy.
       */
      beforeDestroy() {
        self.stopActiveFetch()
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
          // Drop the superseded fetch's per-region status entries with it.
          // `regionStatuses` is keyed by displayedRegionIndex, so a supersede
          // that needs fewer regions than the one it replaced would otherwise
          // leave the extra keys in the aggregate for its whole duration and
          // report a progress fraction mixed from two fetches. Every caller
          // that reaches here via `cancelFetch` already cleared them; this
          // covers a direct `runFetch` over a live one.
          self.resetStatus()
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
          yield work({
            stopToken,
            isStale,
            statusCallback: self.makeStatusCallback(() => !isStale()),
          })
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Fetch failed:', e)
            if (!isStale()) {
              self.error = e
            }
          }
        } finally {
          if (!isStale()) {
            // Release this fetch's stop token now that it has ended, which drops
            // the AbortSignal controllers taken against it — resetStatus only
            // drops the model's reference, so without this a completed fetch's
            // token keeps holding them. The stale branch is a
            // superseded fetch: whoever superseded it (runFetch start or
            // stopActiveFetch) already released this token, so skip it.
            stopStopToken(stopToken)
            self.resetStatus()
            self.fetchGeneration++
          }
        }
      }),
    }))
    .views(self => ({
      /**
       * #method
       * Per-region variant of `makeStatusCallback`: routes progress through
       * `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate
       * into one status bar instead of clobbering each other. Same `isAlive`
       * guard; `setRegionStatus` owns the throttling (it has to thin only the
       * bar write, not the per-region bookkeeping).
       */
      makeRegionStatusCallback(key: number) {
        return (status: RpcStatus) => {
          if (isAlive(self)) {
            self.setRegionStatus(key, status)
          }
        }
      },
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
