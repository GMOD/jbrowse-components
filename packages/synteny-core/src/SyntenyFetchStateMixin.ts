import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SyntenyFetchStateMixin
 * #category display
 *
 * The fetch-lifecycle bookkeeping shared by the two comparative displays
 * (LinearSyntenyDisplay, DotplotDisplay): whether an RPC is in flight, the
 * signature of the inputs the held data was fetched for, the one-shot
 * reversed-assembly flag, and the two members the overlay's buttons are — the
 * `reloadCounter` behind Retry and the `fetchCanceled` behind Cancel.
 *
 * Composed rather than duplicated so the two displays can't drift on what
 * "loading" versus "refetching" means — the difference decides whether the user
 * gets a full overlay or a corner spinner. What is computed FROM these pieces —
 * each display's `displayPhase` and each view's `settled` gate — lives in
 * `comparativeReadiness.ts`, as functions rather than as members here, for the
 * `error` reason below.
 *
 * `loading`/`refetching`/`dataCurrent`/`svgReady` themselves stay on each
 * display, and the reason is **`error`**, not the inputs you would guess.
 * `ready` (each display holds its data in a different field) and
 * `currentFetchKey` (view-specific inputs) could both be default-false hooks
 * here, exactly as `fetchInert` is. `error` could not: it is a `BaseDisplay`
 * volatile, and three of those four getters read it. Declaring it here to make
 * them type-check would put a second `error` in the compose chain, where one
 * set silently wins by argument order — the hazard `FetchMixin` documents
 * against ADR-041 and the thing this mixin exists to avoid, not reproduce.
 *
 * Note what is *not* the reason, since an earlier version of this comment said
 * it was: none of the four is genuinely different between the two displays.
 * Both `loading`s subtract `fetchInert` and both `svgReady`s pass it as
 * `extraTerminal` (with `fetchCanceled` beside it), so the pairs differ only
 * in which field holds the data (`ready` vs `instanceData`) and in the
 * view-specific fetch key. If `error` ever becomes visible here, all four move
 * up together.
 */
export function SyntenyFetchStateMixin() {
  return types
    .model('SyntenyFetchState', {})
    .volatile(() => ({
      /**
       * #volatile
       * True while an RPC fetch is in-flight. Combined with `ready` it
       * distinguishes a first load (no data yet — full overlay) from a refetch
       * (stale content still on screen — corner indicator).
       */
      fetching: false,
      /**
       * #volatile
       * Fetch-input signature the currently held data was fetched for (each
       * display builds its own `currentFetchKey`). Compared against the live
       * inputs in `dataCurrent` to catch data gone stale after a region/zoom
       * change — including during the pre-refetch debounce gap, where
       * `fetching` is still false and would otherwise report done on content
       * drawn against the old viewport.
       */
      loadedFetchKey: undefined as string | undefined,
      /**
       * #volatile
       * Set once at view load by a refName-comparison check, independent of the
       * per-render fetch, so it never re-fires or misfires on zoom. Surfaces
       * through each display's `warnings`.
       */
      assembliesSwapped: false,
      /**
       * #volatile
       * Bumped by `reload()`. Read unconditionally by
       * `installComparativeFetchAutorun`, so it is always in the autorun's
       * dependency set — which is the whole point: after an error the fetch
       * inputs are unchanged, so nothing else would ever refire the autorun and
       * the error banner's Retry would be a button that does nothing.
       */
      reloadCounter: 0,
      /**
       * #volatile
       * True from the moment the user clicks Cancel on the loading overlay
       * (`cancelFetchByUser`) until `reload()` clears it. Durable and
       * blocking: `installComparativeFetchAutorun` gates on it, so nothing
       * restarts the load in the meantime — not a zoom, not a region change,
       * and no timer.
       *
       * That is the deliberate half. These displays sit on single RPCs that can
       * run for minutes against a remote index, so a cancel any pan quietly
       * undoes is not a cancel, and a retry that re-arms itself hammers the
       * server that just failed. The way back is the overlay's Retry button
       * and nothing else — `LoadingOverlay` draws it off this flag.
       */
      fetchCanceled: false,
      /**
       * #volatile
       * Stops the in-flight RPC. `installComparativeFetchAutorun` hands over
       * its stop-token rotation's `cancel` at install (`setStopActiveFetch`):
       * the rotation lives in that skeleton's closure, one per install and
       * beside the fetch that uses it, and this mixin holds no fetch machinery
       * of its own (ADR-054).
       *
       * **A cancel that cannot reach it is not a cancel.** Nothing else
       * rotates the token, so the run the user stopped watching stays
       * `isCurrent()` and COMMITS its result when it lands — the plot appears,
       * the overlay disappears, and the cancel is undone by the fetch it
       * cancelled. Stopping the token is also the only thing that tells the
       * worker to drop the reads still in flight, which is half of why a user
       * clicks it.
       *
       * A no-op until the skeleton installs, so a display with no fetch
       * autorun can still be asked.
       */
      stopActiveFetch: () => {},
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook, default false: the states where this display's fetch
       * autorun deliberately never runs, so it holds no data and none is
       * coming. Anything waiting on data has to treat those as terminal rather
       * than wait forever — which is why the answer lives in one place and is
       * read by the autorun's own gate, the loading overlay, the SVG export's
       * `extraTerminal`, and `displaysSettled` below.
       *
       * `displaysSettled` is the reason this is a mixin hook rather than a
       * display-local getter: it is the one reader outside the display, and
       * without the hook it demanded `dataCurrent` from a display whose
       * `loadedFetchKey` can never be set — wedging the view's `settled` gate,
       * and with it the `data-display-drawn` screenshot capture waits on.
       *
       * Default false is the strict answer, so a display that grows an inert
       * state and forgets to say so keeps waiting for data (diagnosable) rather
       * than reporting done without it (silently wrong). Dotplot leaves it:
       * its `prepare` bails only before the view is initialized, which the
       * view's own `canvasDrawn`/`canRender` gate already covers.
       */
      get fetchInert(): boolean {
        return false
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFetching(arg: boolean) {
        self.fetching = arg
      },
      /**
       * #action
       */
      setAssembliesSwapped(arg: boolean) {
        self.assembliesSwapped = arg
      },
      /**
       * #action
       * Install-time wiring, called once by
       * `installComparativeFetchAutorun` — see `stopActiveFetch` for why the
       * stop arrives from there rather than being built here.
       */
      setStopActiveFetch(stop: () => void) {
        self.stopActiveFetch = stop
      },
      /**
       * #action
       * The loading overlay's Cancel. Stops the in-flight RPC and lands in the
       * durable `fetchCanceled` state, so the fetch autorun's gate holds until
       * `reload()` reopens it.
       *
       * Same name as `FetchMixin`'s, which is what lets one overlay set serve
       * all three fetch families (`DisplayLoadingOverlayModel` names it). What
       * has no twin here is the *internal* half of that split, `cancelFetch` —
       * stop, clear the flag, bump a generation to retrigger — because it
       * exists there for `clearAllRpcData`, and this family has nothing that
       * resets a display behind the user's back. `reload()` is the only thing
       * that reopens the gate, which is exactly the constraint: retry is a
       * button, never an automatic re-arm.
       *
       * Clears `fetching` itself, because nothing else will: the in-flight
       * run's `finally` writes it only while `isCurrent()`, and the stop above
       * just closed that guard.
       */
      cancelFetchByUser() {
        self.stopActiveFetch()
        self.fetching = false
        self.fetchCanceled = true
      },
      /**
       * #action
       * Re-run the fetch. The display's half of the retry contract
       * (agent-docs/reference/DISPLAYCHROME.md §"The retry contract"): every
       * state that can raise an error banner must be one this
       * actually undoes. Clearing the error is not enough on its own — the
       * autorun re-clears it at the start of each run anyway — so this bumps a
       * counter the autorun tracks, which is what makes the refetch happen.
       *
       * It clears `fetchCanceled` as well, and that is the second half rather
       * than a tidy-up: the cancel is deliberately durable, so this is the only
       * thing in the family that reopens the autorun's gate. A `reload()` that
       * bumped the counter alone would wake the autorun into a run the gate
       * still refuses — the dead Retry `makeRetryContractCheck` reports, and
       * the one the overlay's own button would be.
       */
      reload() {
        // The cancel gate, cleared synchronously: the overlay flips off
        // "Loading canceled" on the click rather than a debounce later, and
        // the gate is already open when the counter bump wakes the autorun.
        // Clearing it here and only here is what keeps `fetchCanceled`
        // durable — `installComparativeFetchAutorun`'s gate is the reader, and
        // no fetch clears it on the way past (it cannot be true at a fetch
        // start, since the gate is above the fetch).
        self.fetchCanceled = false
        self.reloadCounter += 1
      },
    }))
}

/**
 * One thing that went wrong during a comparative fetch, as the warning dialog
 * lists it: what happened, and what it means for the plot on screen. Named here
 * rather than spelled inline at each of the three places that had it (the
 * display's held list, the swap warning below, the dialog's row type), so a
 * field added to one is a type error at the others rather than a silently
 * dropped column.
 */
export interface ComparativeWarning {
  message: string
  effect: string
}

// Both displays detect the same misconfiguration — the file's chromosome names
// match the opposite axis/row — so they must say the same thing about it. Only
// the remedy differs (which control the user reaches for), so the caller
// supplies that and the diagnosis is written once.
export function swappedAssembliesWarning(effect: string): ComparativeWarning {
  return {
    message: 'The assemblies appear to be in the wrong order',
    effect,
  }
}
