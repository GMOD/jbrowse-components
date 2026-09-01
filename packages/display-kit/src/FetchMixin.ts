import { noteFetchStarted } from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { createStopTokenRotation } from '@jbrowse/core/util/createStopTokenRotation'
import { makeFetchContext } from '@jbrowse/core/util/fetchContext'
import { runFetchOnce } from '@jbrowse/core/util/installFetch'
import { localStorageGetBoolean } from '@jbrowse/core/util/localStorage'
import {
  createStatusWindow,
  progressLabel,
  statusFraction,
  statusMessageText,
} from '@jbrowse/core/util/progress'
import { flow, isAlive, types } from '@jbrowse/mobx-state-tree'

import { serializeRpcProps } from './rpcPropsCacheKey.ts'

import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { RpcStatus } from '@jbrowse/core/util/progress'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export { makeFetchContext }
export type { FetchContext }

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

/**
 * The three members {@link fetchMixinLifecycle} calls, as the shape a fetch
 * outside this mixin's own flow needs of its host. `GlobalFetchHost` names them
 * again for the same reason every duck-typed host in the tree does: the mixin's
 * `Instance` type would be circular from inside a file the mixin composes.
 */
export interface FetchLifecycleHost {
  beginFetch: (stopToken: StopToken) => void
  endFetch: (current: boolean) => void
  setError: (error?: unknown) => void
}

/**
 * This mixin's begin/end/error bookkeeping as the `FetchLifecycle` the shared
 * skeleton takes, for the two entries that run a fetch over it: `runFetch`
 * below, and the global
 * family's `installFetch` declaration, which lends this mixin's rotation and so
 * owes the same three writes. It was the same object literal in both, which is
 * one drift axis over a trio whose whole value is that a superseded run and a
 * current one are treated differently in exactly one place.
 */
export function fetchMixinLifecycle(self: FetchLifecycleHost) {
  return {
    setError: (error?: unknown) => {
      self.setError(error)
    },
    onBegin: (stopToken: StopToken) => {
      self.beginFetch(stopToken)
    },
    onEnd: (current: boolean) => {
      self.endFetch(current)
    },
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
// fetchGeneration bumps when a CURRENT fetch ends (success or error — a
// superseded run must not bump for the run that replaced it) and on
// `cancelFetch`; `cancelFetchByUser` deliberately does not bump, which is what
// makes that cancel durable. Autoruns read `void self.fetchGeneration` to
// re-evaluate after a fetch completes; isLoading is not used as a dependency to
// avoid an extra fire on fetch start.
//
// Composed by both per-region (MultiRegionDisplayMixin) and single-data
// (GlobalFetchMixin) families.
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
       * Bumped by `reload()` and read unconditionally by the fetch autoruns,
       * so a user retry re-runs the body even where nothing else moved — after
       * an error every other fetch input is unchanged. It is also the half
       * that survives a `reload()` override that forgets to invalidate, which
       * is the dead Retry button `makeRetryContractCheck` reports. Declared
       * here because this is the one mixin both LGV fetch foundations compose,
       * the same argument that put `fetchInert` below; the comparative family
       * carries its own on `SyntenyFetchStateMixin` (ADR-054).
       */
      reloadCounter: 0,

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
    .volatile(self => ({
      /**
       * #volatile
       * **The latest-wins machine this mixin is a wrapper around**, and not a
       * second one: `createStopTokenRotation` owns token rotation, the
       * `isCurrent` guard, the status slot and the supersede-versus-end rule
       * (ADR-080, ADR-081), for every fetch in the codebase that has one.
       * `runFetch` adds the observable bookkeeping a display needs on top —
       * `isLoading`, `error`, `fetchGeneration`, `fetchCanceled` — and nothing
       * else.
       *
       * It was two implementations of that machine until 2026-08-20, which is
       * how they came to disagree about whether a completed fetch releases its
       * token. A display's *primary* fetch is this wrapper; a second concurrent
       * fetch on the same node holds a rotation of its own, which is why the
       * primitive is the thing that exists and this is the thing built on it
       * (ADR-054 §1).
       *
       * It is lent this display's `statusWindow`, so the fetch takes a slot on
       * the one field rather than opening a second window over it — the whole
       * point of `StatusReporter`.
       */
      fetchRotation: createStopTokenRotation(self, {
        statusWindow: self.statusWindow,
      }),
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
       * - the retry contract check (`makeRetryContractCheck`), which would
       *   otherwise report a dead Retry on a display correctly declining to
       *   load anything.
       *
       * It was three hooks — `loadingSuppressed`, `svgReadyExtraTerminal` on
       * each of the two foundations, and `fetchInert` on the comparative
       * family, which had already collapsed them. Both LGV displays that
       * override it returned one expression for all three, and one of the three
       * was hard-coded `false` on the global family for a while, which is how
       * LD came to be able to express only half its own state. Same name and
       * same meaning as `SyntenyFetchStateMixin.fetchInert` now, so the retry
       * check reads one field across all three fetch families. ADR-082.
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
       * Overridable hook (default false), read by the per-region fetch plan:
       * the display is drawing something in the features' place and wants no
       * fetch while it does. `DensityTierMixin` says it while the band is up
       * and the gate is not blocking, so a track forced to `density` never
       * downloads the features it will not draw, while a refused viewport
       * keeps its measurement pass and the gate can still release.
       *
       * Not `fetchInert`: that one suppresses the scrim and ends the export
       * wait, and a display saying this still has its stand-in to load.
       *
       * Read by the per-region plan alone: the global and comparative fetch
       * families do not consult it, so a display of theirs composing the tier
       * would get the band and keep fetching.
       */
      get fetchSuspended(): boolean {
        return false
      },

      /**
       * #getter
       * Overridable hook (default false), read only by the retry contract check
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
       * `fetchInert` above, which the loading scrim and the export read too.
       */
      get awaitingPrerequisite(): boolean {
        return false
      },

      /**
       * #getter
       * Overridable hook (default false), read by `computeLoadingTerm`: a load
       * this display depends on beyond its primary fetch has not landed for the
       * first time, so the frame the primary fetch calls current is still
       * missing something. Multi-way synteny says it until its lane genes and
       * lane links first arrive, so an export or a capture never lands between
       * the ortholog fetch and the gene models that fill the lanes.
       *
       * A hook rather than a `displayPhase` override, for the reason
       * `fetchInert` is one: that display carried the override, restating the
       * foundation's two arguments verbatim to append one term, which is the
       * shape that silently misses the next term added.
       *
       * Not `dataSuperseded`, which holds the export through every later
       * refetch too: a display saying this wants the scrim on the first landing
       * only, since later lane fetches redraw over lanes already on screen.
       */
      get awaitingDependentData(): boolean {
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
    }))
    .actions(self => ({
      /**
       * #action
       * Abort the in-flight fetch (if any) and retire its slot. The shared
       * preamble of both cancel paths; the difference between them is only what
       * they do to `fetchCanceled` / `fetchGeneration` afterward.
       */
      stopActiveFetch() {
        // Unconditional, unlike the token check it replaced: `cancel` is
        // already a no-op with nothing in flight, and calling it anyway retires
        // a slot a torn-down fetch left voting.
        //
        // It retires this fetch's SLOT and nothing else. The window is not reset
        // here — `reset` is for teardown, and this runs on every
        // `clearAllRpcData`, so a display with a second operation reporting
        // (HiC's header read, the multi-sample sources fetch, a clustering run)
        // would have that operation's queued write dropped by every settings
        // change. The write that goes first is the re-derive `clear` queues to
        // move the field off the fetch's label and onto the sibling's, which is
        // the ADR-081 failure exactly.
        self.fetchRotation.cancel()
        self.activeStopToken = undefined
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
       * The display's half of the retry contract (DISPLAYCHROME.md), in the
       * one mixin every fetching LGV display composes: clear the error the
       * banner is showing, clear the durable user-cancel synchronously so the
       * overlay flips from "canceled" to "loading" now rather than when the
       * debounced fetch begins, and bump the counter every fetch trigger reads
       * unconditionally. Each foundation chains this and adds the one
       * invalidation its own freshness gate needs; a display with extra
       * teardown chains the foundation's. `reloadReachesCounter.test.ts` reads
       * every `reload()` in the tree for the override that forgets.
       */
      reload() {
        self.setError(undefined)
        self.fetchCanceled = false
        self.reloadCounter += 1
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
        // and the window, which nothing short of teardown may reset: a display
        // destroyed BETWEEN fetches — the common case, since a fetch that
        // finished retired its own slot — still has a trailing write standing on
        // a timer. The write itself is already a no-op (the window's sink
        // re-reads `isAlive`), but the timer is not, and jest reports a worker
        // that will not exit rather than anything about a display.
        //
        // Second of two owners of a window that end it with the thing that owns
        // it; `useFetch`'s effect cleanup is the other, and the rotation's own
        // `dispose` is this same call one layer down.
        self.statusWindow.reset()
      },
      /**
       * #action
       * The `onBegin` half of a fetch's bookkeeping: publish the in-flight
       * token (`isLoading`) and clear the durable user-cancel — a load starting
       * is the single clear point that covers every retrigger path (reload,
       * viewport change, settings invalidate). An action of its own for the
       * same reason `endFetch` is: `installFetch`'s lifecycle callbacks run
       * outside any MST flow this mixin owns.
       */
      beginFetch(stopToken: StopToken) {
        if (self.activeStopToken) {
          debugStatus(self.fetchGeneration, 'superseded')
        }
        debugStatus(self.fetchGeneration, 'fetch-start')
        self.activeStopToken = stopToken
        self.fetchCanceled = false
      },
      /**
       * #action
       * The `finally` half of `runFetch`'s bookkeeping, an action of its own
       * because `runFetchOnce`'s `finally` resumes on a microtask the flow does
       * not own — a direct volatile write there is outside the action context,
       * which is the one thing hoisting the sequence into a shared function
       * costs. The stale branch is a superseded fetch, which must not clear the
       * loading flag the run that replaced it just set. The stop token itself
       * is released by the rotation's own `end()`, one layer down.
       */
      endFetch(current: boolean) {
        if (current) {
          self.activeStopToken = undefined
          self.fetchGeneration++
          debugStatus(self.fetchGeneration, 'fetch-end')
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Run a cancel-safe fetch (cancels any prior). The work callback gets a
       * FetchContext with a stopToken to forward to the RPC and an isStale()
       * check to short-circuit commits once the user has moved on.
       *
       * **The MST-flow wrapper over the shared `runFetchOnce` sequence**, and
       * only the wrapper: the begin/clear/run/commit/error/end order, and the
       * rules that keep a superseded run from writing back, are the same
       * function every other fetch in the tree runs. What this adds is the
       * observable bookkeeping a display needs — `isLoading` through
       * `activeStopToken`, `fetchGeneration`, the user-cancel clear — and the
       * flow itself, which is an action, so `work`'s synchronous prefix runs
       * untracked wherever a fetch autorun calls this.
       */
      runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
        // Dev-only, and the one place every family's fetches pass through, which
        // is why the retry check watches here: a fetch answers an outstanding
        // `reload()` wherever that reload reached it from, including a `reload()`
        // that fetches directly instead of leaving it to a fetch autorun.
        noteFetchStarted(self)
        // Rotating IS the supersede: it stops the prior token and opens this
        // fetch's slot before the run being replaced reaches its `finally`,
        // which is what keeps the label the overlay is showing alive across the
        // handover. The guard it hands back closes on a newer fetch, on
        // `cancel`, on teardown, and on this fetch's own `end` — the four ways a
        // fetch stops being the answer.
        const active = self.fetchRotation.begin()
        yield runFetchOnce<void, void>(self, active, undefined, {
          run: (_args, ctx) => work(ctx),
          // the work callback commits through `ctx` as each region's payload
          // lands, so this family has no single payload to hand a commit phase
          commit: () => {},
          ...fetchMixinLifecycle(self),
        })
      }),
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
