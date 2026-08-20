import { noteFetchStarted } from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import {
  createStatusWindow,
  isAbortException,
  localStorageGetBoolean,
  progressLabel,
  statusFraction,
  statusMessageText,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'

import { serializeRpcProps } from './rpcPropsCacheKey.ts'

import type {
  RpcStatus,
  StatusCallback,
  StatusStream,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Every write to a display's status field, on the console, when
 * `localStorage.debugStatus = true`. For the report this cannot be reproduced
 * from: a status field that flickers between a phase label and the overlay's
 * `'Loading'` fallback says nothing on its own about *why*, and the two causes
 * want opposite fixes. `gen` is the discriminator — a flicker inside one fetch
 * holds one generation, while a fetch being superseded over and over (a pan, a
 * linked view resyncing, an invalidating setting) steps it every time.
 *
 * Read from localStorage on every call rather than once, so it can be switched
 * on mid-session from the console with no reload.
 */
function debugStatus(gen: number, event: string, detail = '') {
  if (localStorageGetBoolean('debugStatus', false)) {
    // a deliberate debug channel, off unless the key is set
    // eslint-disable-next-line no-console
    console.log(
      `[jbrowse-status] ${Math.round(performance.now())}ms gen=${gen} ${event}${detail && ` ${JSON.stringify(detail)}`}`,
    )
  }
}

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

// The status field's single writer, which is what the window is opened over.
// `self` inside a volatile initializer is the empty model the chain starts from
// and `setStatusMessage` arrives three steps later, so the cast names the one
// member it calls; the write itself runs long after the chain is finished.
interface StatusWriter extends IStateTreeNode {
  setStatusMessage: (status?: RpcStatus) => void
}

function writeStatus(self: unknown) {
  return (status: RpcStatus | undefined) => {
    const model = self as StatusWriter
    if (isAlive(model)) {
      model.setStatusMessage(status)
    }
  }
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
    .volatile(self => ({
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
       * This display's status field, and the only thing that writes it: one
       * throttle window, one slot per concurrent operation, so N parallel
       * per-region fetches thin to one stream between them rather than N and a
       * second operation cannot end the first one's label (ADR-081). Lent whole
       * to `createStopTokenRotation` by a display that also runs a bare-autorun
       * fetch — see `StatusReporter`.
       */
      statusWindow: createStatusWindow(writeStatus(self)),

      /**
       * #volatile
       * The in-flight fetch's slot, so a cancel can retire it now rather than
       * whenever the worker gets around to noticing the stop token. `runFetch`
       * retires it again in its `finally`; retiring twice is a no-op.
       */
      activeStatusStream: undefined as StatusStream | undefined,

      // error / statusMessage / statusProgress below duplicate BaseDisplay's,
      // so this mixin composes standalone (its own tests) as well as onto a
      // display. In a real composition one set wins — which is exactly why the
      // throttle policy lives in the shared `createStatusWindow` and not in
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
       * Overridable hook (default false): the states where this display
       * deliberately never fetches, so it holds no data and none is coming.
       * Sequence sets it past base resolution ("Zoom in to see sequence"); LD
       * sets it with the triangle toggled off.
       *
       * **One hook, three readers**, and that is the whole point — a display
       * that grows such a state has one thing to say rather than three, and the
       * reader it would have forgotten is always the one outside itself:
       *
       * - the loading scrim (`computeLoadingTerm`), which otherwise parks over
       *   the placeholder, permanently once a cancel has been clicked;
       * - the SVG export (`computeSvgReady`'s `extraTerminal`), whose
       *   `awaitSvgReady` is an unbounded `when`, so one such display hangs the
       *   whole view's export;
       * - the dev-only retry check (`makeRetryContractCheck`), which would
       *   otherwise report a dead Retry on a display correctly declining to
       *   load anything.
       *
       * It was three hooks — `loadingSuppressed`, `svgReadyExtraTerminal` on
       * each of the two foundations, and `fetchInert` on the comparative
       * family, which had already collapsed them. Both LGV displays that
       * override it returned one expression for all three, and one of the
       * three was hard-coded `false` on the global family for a while, which is
       * how LD came to be able to express only half its own state. Same name
       * and same meaning as `SyntenyFetchStateMixin.fetchInert` now, so the
       * retry check reads one field across all three fetch families.
       *
       * A hook rather than a `displayPhase` override, because overriding the
       * getter means restating the whole loading condition — which is how
       * sequence came to hold a verbatim copy of the other terms, one `git blame`
       * away from silently missing the next one added.
       *
       * It lives **here** because this is the one mixin all three display
       * foundations compose. Same argument, one level down, that put
       * `rendersCanvas` on `RenderLifecycleMixin` beside `canvasDrawn`.
       */
      get fetchInert(): boolean {
        return false
      },

      /**
       * #getter
       * Overridable hook (default false), read only by the dev-only retry check
       * (`makeRetryContractCheck`): "this run declined because a prerequisite
       * fetch in another autorun has not landed, and its arrival wakes this one
       * again". It **defers** the retry verdict to that later run rather than
       * waiving it, so a display cannot spend its retry on a decline it called
       * preliminary.
       *
       * Two displays say it, one per fetch foundation, which is why it lives
       * beside `fetchInert` rather than on either: HiC's contacts fetch
       * declines until `CoreGetInfo` lands, and `MultiSampleVariantBaseModel`'s
       * `fetchNeeded` declines until `sourcesBase` does. Both have a `reload()`
       * that wakes the prerequisite's autorun as well as their own.
       *
       * **It has to be strictly narrower than the gate it explains.** One that
       * restates the gate's negation makes every decline a deferred one, so no
       * run is ever judged and the display has silently opted out — an exemption
       * by another name. HiC is in that shape deliberately, because its gate and
       * its prerequisite are one condition; what covers its retry instead is
       * `LinearHicDisplay/infoFetchFailure.test.ts`.
       *
       * Not for a display deliberately not fetching at all — that is
       * `fetchInert` above, which the loading scrim reads too.
       */
      get awaitingPrerequisite(): boolean {
        return false
      },

      /**
       * #getter
       * The RPC cache key both fetch foundations invalidate on: this display's
       * `rpcProps()` payload serialized to a string. `serializeRpcProps` owns
       * the why, including the silently-dead-axis corollary.
       *
       * Here, beside the two hooks above, for the same reason they are: it
       * describes the display, and every foundation composes this mixin. The
       * per-region family watches it from `SettingsInvalidate` and the global
       * one from its fetch autorun's trigger list — one getter and one name, so
       * the two cannot come to invalidate on different axes. The global side
       * built its own local `computed` over the same function until 2026-08,
       * which was the same value under a second spelling.
       */
      get rpcPropsCacheKey(): string {
        return serializeRpcProps(self)
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
       * Unthrottled: a display writing a phase label by hand must see every
       * write land. The high-frequency RPC stream is thinned one level up, by
       * the streams `self.statusWindow` hands out — and aggregated across them,
       * which a write by hand is not.
       */
      setStatusMessage(status?: RpcStatus) {
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
        debugStatus(
          self.fetchGeneration,
          'status',
          progressLabel(self.statusMessage, self.statusProgress) || '<blank>',
        )
      },
      /**
       * #action
       * Drop the active stop token and retire the fetch's status slot. Shared
       * by both cancel paths and runFetch's cleanup.
       *
       * Retiring, not blanking: the field goes blank only if this fetch was the
       * last operation reporting on the display. A **superseded** fetch is the
       * case that made it matter first — the one case where the display does
       * not stop loading, and blanking there flashed the overlay's "Loading"
       * fallback between every pan and the phase the view was already in — but
       * a sources fetch or a clustering run beside it is the same problem
       * without the timing coincidence to hide it (ADR-081).
       */
      resetStatus() {
        self.activeStopToken = undefined
        self.activeStatusStream?.clear()
        self.activeStatusStream = undefined
      },
      /**
       * #action
       * Hold the in-flight fetch's slot so a cancel can reach it. `runFetch`
       * keeps its own reference, so this is only for the paths that end a fetch
       * from outside the flow.
       */
      setActiveStatusStream(stream?: StatusStream) {
        self.activeStatusStream = stream
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Abort the in-flight fetch (if any) and retire its slot. The shared
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
       * Open one operation's slot on the display's status field: an RPC
       * `statusCallback` throttled through the display-wide window and guarded
       * so a callback that fires after the node is torn down (RPCs resolve
       * their status stream asynchronously) is a safe no-op, plus the `clear`
       * that retires the slot when the operation ends.
       *
       * **Every operation on the display opens one**, and the two come back
       * together because an operation that never retires goes on voting for a
       * phase that is over. The viewport fetch (`runFetch`), the clustering run
       * and a lent `createStopTokenRotation` are three of them on one field;
       * before ADR-081 each blanked the field outright and the last one to
       * finish decided what the other two were still saying.
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
      openStatusStream(isCurrent: () => boolean) {
        return self.statusWindow.open({ isCurrent })
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
        self.resetStatus()
        // and the window regardless of whether there was a fetch to stop: a
        // display torn down BETWEEN fetches — the common case, since a fetch
        // that finished retired its own slot — left its trailing write standing
        // on a timer. The write itself is already a no-op (the window's sink
        // re-reads `isAlive`), but the timer is not, and jest reports a worker
        // that will not exit rather than anything about a display.
        //
        // Third of three: `createStopTokenRotation.dispose` and `useFetch`'s
        // effect cleanup are the other two owners of a window, and both end it
        // with the thing that owns it.
        self.statusWindow.reset()
      },
      /**
       * #action
       * Run a cancel-safe fetch (cancels any prior). The work callback gets a
       * FetchContext with a stopToken to forward to the RPC and an isStale()
       * check to short-circuit commits once the user has moved on. Abort
       * errors are swallowed; others are stored in `error` if not stale.
       */
      runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
        // Dev-only, and the one place every family's fetches pass through, which
        // is why the retry check watches here: a fetch answers an outstanding
        // `reload()` wherever that reload reached it from, including a `reload()`
        // that fetches directly instead of leaving it to a fetch autorun.
        noteFetchStarted(self)
        if (self.activeStopToken) {
          stopStopToken(self.activeStopToken)
          debugStatus(self.fetchGeneration, 'superseded')
        }
        debugStatus(self.fetchGeneration, 'fetch-start')
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

        // Opened before the superseded fetch retires its own, which is what
        // keeps the label the overlay is showing alive across the handover: the
        // fetch being replaced is suspended at an await and reaches its
        // `finally` a microtask from now, by which point this slot is voting.
        const stream = self.openStatusStream(() => !isStale())
        self.setActiveStatusStream(stream)

        try {
          yield work({
            stopToken,
            isStale,
            statusCallback: stream.statusCallback,
          })
        } catch (e) {
          if (!isAbortException(e)) {
            console.error('Fetch failed:', e)
            if (!isStale()) {
              self.error = e
            }
          }
        } finally {
          // unconditional, unlike everything below it: a superseded fetch has to
          // retire its slot too, or it goes on voting for the phase it stopped
          // in for as long as the display lives
          stream.clear()
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
            debugStatus(self.fetchGeneration, 'fetch-end')
          }
        }
      }),
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
