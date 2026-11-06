import { noteFetchStarted } from '@jbrowse/core/pluggableElementTypes/models/assertDisplayContract'
import { createAbortRotation } from '@jbrowse/core/util/createAbortRotation'
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

import { makeSettingsFetchInputs } from './fetchInputs.ts'

import type { FetchContext } from '@jbrowse/core/util/fetchContext'
import type { RpcStatus } from '@jbrowse/core/util/progress'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export { makeFetchContext }
export type { FetchContext }

/**
 * Every write to a display's status field, on the console, when
 * `localStorage.debugStatus = true` (read on every call, so it can be switched
 * on mid-session). `gen` tells a flicker inside one fetch, which holds one
 * generation, from a fetch superseded over and over, which steps it.
 */
function debugStatus(gen: number, event: string, detail = '') {
  if (localStorageGetBoolean('debugStatus', false)) {
    // eslint-disable-next-line no-console
    console.log(
      `[jbrowse-status] ${Math.round(performance.now())}ms gen=${gen} ${event}${detail && ` ${JSON.stringify(detail)}`}`,
    )
  }
}

// `self` in a volatile initializer is the bare model; `setStatusMessage` is
// declared later in the chain and called long after it is built.
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

/** The three members {@link fetchMixinLifecycle} calls. */
export interface FetchLifecycleHost {
  beginFetch: (signal: AbortSignal) => void
  endFetch: (current: boolean) => void
  setError: (error?: unknown) => void
}

/**
 * This mixin's begin/end/error bookkeeping as the `FetchLifecycle` the shared
 * fetch skeleton takes, for `runFetch` and for the global family's
 * `installFetch`, which lends this mixin's rotation.
 */
export function fetchMixinLifecycle(self: FetchLifecycleHost) {
  return {
    setError: (error?: unknown) => {
      self.setError(error)
    },
    onBegin: (signal: AbortSignal) => {
      self.beginFetch(signal)
    },
    onEnd: (current: boolean) => {
      self.endFetch(current)
    },
  }
}

/**
 * #stateModel FetchMixin
 * #category display
 *
 * Cancel-safe fetch lifecycle for any display that loads data over RPC: abort
 * rotation, staleness, error capture and status reporting. Consumers use
 * `runFetch`, `cancelFetch`, `isLoading`, `error`, `statusMessage` and
 * `fetchGeneration`. Every fetch foundation composes it: the per-region family
 * directly, the global and comparative families through `KeyedFetchMixin`.
 */
export default function FetchMixin() {
  return types
    .model('FetchMixin', {})
    .volatile(self => ({
      /**
       * #volatile
       * signal of the in-flight fetch, or undefined when idle
       */
      activeSignal: undefined as AbortSignal | undefined,
      /**
       * #volatile
       * Bumps when a current fetch ends (never for a superseded one) and on
       * `cancelFetch`, not on `cancelFetchByUser`, which is what makes a user
       * cancel durable. Fetch autoruns read it to re-evaluate.
       */
      fetchGeneration: 0,

      /**
       * #volatile
       * Bumped by `reload()` and read unconditionally by every fetch autorun,
       * so a retry re-runs the body even when no other input moved, as after
       * an error. `makeRetryContractCheck` reports a bump that fetches
       * nothing: a dead Retry button.
       */
      reloadCounter: 0,

      /**
       * #volatile
       * The display's status field's only writer: one throttle window, one
       * slot per concurrent operation, so parallel per-region fetches thin to
       * one stream and one operation cannot end another's label (ADR-081).
       */
      statusWindow: createStatusWindow(writeStatus(self)),

      // error / statusMessage / statusProgress duplicate BaseDisplay's so this
      // mixin composes standalone; ADR-041 is why no shared mixin holds them.

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
       * True after the user cancels a load from the loading overlay. Unlike
       * `cancelFetch` it does not retrigger the fetch autoruns, so the load
       * stays stopped until `reload` or a viewport change; any new fetch
       * clears it.
       */
      fetchCanceled: false,
    }))
    .volatile(self => ({
      /**
       * #volatile
       * The latest-wins machine `runFetch` wraps: abort rotation, the
       * `isCurrent` guard, the status slot and the supersede-versus-end rule
       * (ADR-080, ADR-081). A second concurrent fetch on the same display
       * holds its own rotation (ADR-054 §1). It takes a slot on this
       * display's `statusWindow` rather than opening a second window.
       */
      fetchRotation: createAbortRotation(self, {
        statusWindow: self.statusWindow,
      }),
    }))
    .views(self => ({
      /**
       * #getter
       * true while a fetch is active
       */
      get isLoading() {
        return self.activeSignal !== undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `isLoading` or a user-canceled load: neither has a frame on screen for
       * a hover to describe. Not a phase input, since `computeActivityPhase`
       * tells `loading` from `canceled`.
       */
      get isLoadingOrCanceled() {
        return self.isLoading || self.fetchCanceled
      },

      /**
       * #getter
       * Overridable hook (default false): the states where this display
       * deliberately fetches nothing, such as sequence past base resolution or
       * LD with the triangle off. Three readers depend on it: the phase
       * (`computeActivityPhase`), which would otherwise scrim the placeholder;
       * the SVG export (`computeSvgReady`), whose unbounded wait would hang the
       * view's export; and the retry contract check, which would report a dead
       * Retry. ADR-082.
       *
       * Override this rather than `displayPhase`, which would restate the
       * whole loading condition and miss any term added to it later.
       */
      get fetchInert(): boolean {
        return false
      },

      /**
       * #getter
       * Overridable hook (default false), read only by the retry contract
       * check: this run declined because a prerequisite fetch in another
       * autorun has not landed, and its arrival wakes this one. It defers the
       * retry verdict to that run rather than waiving it, so it must be
       * strictly narrower than the gate it explains; one restating the gate's
       * negation exempts the display from the check. HiC's contacts (waiting
       * on `CoreGetInfo`) and `LinearVariantDisplay` (waiting on
       * `sourcesBase`) set it. For a display not fetching at all, use
       * `fetchInert`.
       */
      get awaitingPrerequisite(): boolean {
        return false
      },

      /**
       * #getter
       * Overridable hook (default false), read by `computeActivityPhase` and
       * `foundationSvgReady`: a load beyond the primary fetch has not landed
       * for the first time, so the frame is still missing something. Multi-way
       * synteny sets it until its lane genes and links first arrive;
       * `TreeSidebarMixin` sets it while a declared clustering run is due.
       * Unlike `dataSuperseded`, it holds the scrim and export on the first
       * landing only.
       */
      get awaitingDependentData(): boolean {
        return false
      },
    }))
    .views(self => {
      const settings = makeSettingsFetchInputs(self)
      return {
        /**
         * #getter
         * The settings axis every fetch family invalidates on: `rpcProps()`
         * and the adapter config, as one value compared structurally. The
         * per-region family stamps it on each region, the keyed families fold
         * it into `currentFetchKey`, and the byte gate measures under it.
         */
        get settingsFetchInputs(): unknown {
          return settings.get()
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
      /**
       * #action
       * Unthrottled, so a phase label written by hand always lands; the RPC
       * stream is thinned by the slots `statusWindow` hands out.
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
       * Abort the in-flight fetch, if any, and retire its status slot: the
       * shared preamble of both cancel paths. It never resets the window,
       * which would drop a sibling operation's queued status write on every
       * `clearAllRpcData` (ADR-081); only teardown resets it.
       */
      stopActiveFetch() {
        self.fetchRotation.cancel()
        self.activeSignal = undefined
      },
      /**
       * #action
       * Open a slot on the display's status field for an operation outside any
       * fetch, such as the tree sidebar's clustering run: a throttled RPC
       * `statusCallback` and the `clear` that retires it. `isCurrent` is
       * required because a live node is not enough: a superseded run's late
       * status must not repaint the overlay of the run that replaced it.
       */
      openStatusStream(isCurrent: () => boolean) {
        return self.statusWindow.open({ isCurrent })
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Cancel any in-flight fetch, clear a user cancel and bump
       * `fetchGeneration`, so the fetch autoruns re-fetch. The internal reset
       * `clearAllRpcData` runs.
       */
      cancelFetch() {
        self.stopActiveFetch()
        self.fetchCanceled = false
        self.fetchGeneration++
      },
      /**
       * #action
       * The loading overlay's Cancel: stop the fetch and set the durable
       * `fetchCanceled`, without bumping `fetchGeneration`, so nothing
       * restarts the load until `reload` or a viewport change.
       */
      cancelFetchByUser() {
        self.stopActiveFetch()
        self.fetchCanceled = true
      },
      /**
       * #action
       * The display's half of the retry contract (DISPLAYCHROME.md): clear
       * the error, clear a user cancel at once so the overlay flips to
       * loading, and bump `reloadCounter`. Each foundation chains this and adds
       * the invalidation its freshness gate needs. An override that neither
       * chains nor bumps the counter turns the retry check off;
       * `reloadReachesCounter.test.ts` reads every `reload()` in the tree.
       */
      reload() {
        self.setError(undefined)
        self.fetchCanceled = false
        self.reloadCounter += 1
      },
      /**
       * #action
       * Abort an in-flight fetch on teardown, so a closed track stops
       * downloading, and reset the status window, whose trailing write still
       * holds a timer after the last fetch ends.
       */
      beforeDestroy() {
        self.stopActiveFetch()
        self.statusWindow.reset()
      },
      /**
       * #action
       * The `onBegin` half of a fetch's bookkeeping: publish the signal
       * (`isLoading`) and clear a user cancel, the one clear point every
       * retrigger path passes through.
       */
      beginFetch(signal: AbortSignal) {
        if (self.activeSignal) {
          debugStatus(self.fetchGeneration, 'superseded')
        }
        debugStatus(self.fetchGeneration, 'fetch-start')
        self.activeSignal = signal
        self.fetchCanceled = false
      },
      /**
       * #action
       * The `onEnd` half, an action because `runFetchOnce`'s `finally` runs
       * outside the flow. A superseded fetch writes nothing, or it would clear
       * the loading flag of the fetch that replaced it.
       */
      endFetch(current: boolean) {
        if (current) {
          self.activeSignal = undefined
          self.fetchGeneration++
          debugStatus(self.fetchGeneration, 'fetch-end')
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Run a cancel-safe fetch, superseding any prior one. `work` gets a
       * `FetchContext` with the signal to forward to the RPC and `isStale()`
       * to skip commits once the user has moved on. The sequence is the shared
       * `runFetchOnce`; this adds the observable bookkeeping and the flow,
       * which runs `work`'s synchronous prefix untracked.
       */
      runFetch: flow(function* (work: (ctx: FetchContext) => Promise<void>) {
        // Every family's fetches pass here, so a fetch answers an outstanding
        // `reload()` wherever that reload reached it from.
        noteFetchStarted(self)
        const active = self.fetchRotation.begin()
        yield runFetchOnce<void, void>(self, active, undefined, {
          run: (_args, ctx) => work(ctx),
          // the work callback commits through `ctx` as each region lands
          commit: () => {},
          ...fetchMixinLifecycle(self),
        })
      }),
    }))
}

export type FetchMixinType = ReturnType<typeof FetchMixin>
