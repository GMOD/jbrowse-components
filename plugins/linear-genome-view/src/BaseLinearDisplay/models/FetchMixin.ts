import {
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
   * The RPC `statusCallback` for the work this context describes: guarded to
   * this fetch (a superseded one cannot repaint the overlay of the fetch that
   * replaced it) and throttled through the display-wide window. Pass it as the
   * `statusCallback` RPC arg — there is no per-display variant to choose
   * between, which is the point.
   *
   * The fan-out helpers hand each region a context whose callback is that
   * region's own slot (`callEachRegion`, and `fetchEachRegion` through it), so
   * `statusCallback: ctx.statusCallback` aggregates N parallel regions into one
   * bar in the fan-out case and reports the whole fetch in the batched one.
   * Reading it off the model instead — or reusing the *outer* ctx's inside a
   * fan-out — is what made parallel regions clobber each other's progress, and
   * is now the thing you would have to go out of your way to do.
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
         * Run `apply` now, dropping any write queued behind it. The escape from
         * `throttleStatus` for a write that must land and that supersedes what
         * it was queued behind — the `''` closing a phase is both.
         */
        flushStatus(apply: () => void) {
          throttle.runNow(apply)
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
       * `isCurrent` is required and has no "node is alive" default, because
       * alive is not the interesting question: a *superseded* fetch is on a live
       * node, and its late status repainting the overlay of the fetch that
       * replaced it is the failure this guards. `runFetch` passes `!isStale()`,
       * which is what every display gets for free through `ctx.statusCallback`;
       * a caller outside a fetch (the clustering autorun) passes its own run's
       * flag. Defaulting to `isAlive` made the loose answer the easy one and
       * five displays took it.
       *
       * Declared this early only so `runFetch` can put one on every
       * `FetchContext`.
       */
      makeStatusCallback(isCurrent: () => boolean) {
        return createGuardedStatusSink({
          isCurrent,
          sink: status => {
            self.setStatusMessage(status)
          },
          // the model-wide window, so N of these thin to one stream between them.
          // `run` only: the sink throttles every status now, `''` included, so
          // it has no use for `flushStatus` — that stays for the hand-written
          // clears (`createStopTokenRotation`).
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
        // and the status window regardless of whether there was a fetch to
        // stop: `stopActiveFetch` resets only when it finds a live token, so a
        // display torn down BETWEEN fetches — the common case, since a fetch
        // that finished cleared its own token — left its trailing write
        // standing on a timer. The write itself is already a no-op (the sink
        // re-reads `isAlive`), but the timer is not, and jest reports a worker
        // that will not exit rather than anything about a display.
        //
        // Third of three: `createStopTokenRotation.dispose` and `useFetch`'s
        // effect cleanup are the other two owners of a window, and both end it
        // with the thing that owns it.
        self.resetStatus()
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
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
