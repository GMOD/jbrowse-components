import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import KeyedFetchMixin from '@jbrowse/display-kit/KeyedFetchMixin'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel ComparativeFetchMixin
 * #displayFoundationDef One single-payload fetch keyed on both views' state, drawn onto a canvas the containing view owns — no render lifecycle and no byte gate here. Installs no fetch autoruns; the display adds its own via `installComparativeFetchAutorun`.
 * #category display
 *
 * The fetch foundation of the two comparative displays (LinearSyntenyDisplay,
 * DotplotDisplay): `KeyedFetchMixin` — `FetchMixin`'s rotation, loading flag,
 * error, status, durable cancel and retry, plus the `currentFetchKey` /
 * `loadedFetchKey` freshness pair the LGV global family runs on — and, on top,
 * the two-way loading answer a shared canvas wants — `loading` off the
 * `fetchLanded` hook, `refetching` off `isLoading` — and the one-shot
 * reversed-assembly flag.
 *
 * Until 2026-09 this was `SyntenyFetchStateMixin`, a second spelling of every
 * `FetchMixin` member the overlay reads — `fetching` for `isLoading`, its own
 * `reloadCounter` / `fetchCanceled` / `reload` / `cancelFetchByUser`, a stop
 * handed back from the installer because the rotation lived there — kept apart
 * on the grounds ADR-054 gives and ADR-105 retires. `error` is what kept the
 * four flags below out of that mixin: it is a `BaseDisplay` volatile the flags
 * read, and declaring a second one to make them type-check is the ADR-041
 * hazard. `FetchMixin` is the one declaration site that already wins that
 * compose, so composing it is what lets the flags be getters here.
 *
 * `loading` and `refetching` are different questions, and the difference
 * decides whether the user gets a full overlay or a corner chip
 * (`ComparativeFetchStatus`). `displayPhase` stays per display — it reads the
 * shared canvas's `surfaceReadiness`, which each view publishes differently —
 * through `comparativeDisplayPhase`.
 */
export function ComparativeFetchMixin() {
  return types
    .compose('ComparativeFetchMixin', KeyedFetchMixin(), types.model({}))
    .volatile(() => ({
      /**
       * #volatile
       * Set once at view load by a refName-comparison check, independent of the
       * per-render fetch, so it never re-fires or misfires on zoom. Surfaces
       * through each display's `warnings`.
       */
      assembliesSwapped: false,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook (default false): a fetch has completed and data is
       * present, even if it mapped zero features. Not a feature-count test —
       * an empty-but-finished fetch has landed, or an empty plot spins its
       * overlay forever. Each display answers off its own payload field, which
       * survives a `reload()` where `loadedFetchKey` does not: that is what
       * keeps a retry on the corner chip rather than the full overlay.
       *
       * Default false is the strict answer — a display that forgets the
       * override shows its first-load overlay forever (diagnosable) rather
       * than reporting done over nothing (silently wrong).
       */
      get fetchLanded(): boolean {
        return false
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overridable hook: the display holds something an SVG export can draw.
       * Defaults to `fetchLanded`; the dotplot answers with its instance geometry
       * rather than its `geometry` computed, because `svgReady` is polled
       * outside any reactive context and a `geometry` read there recolors every
       * segment per poll.
       */
      get hasDrawable(): boolean {
        return self.fetchLanded
      },
      /**
       * #getter
       * First load, nothing on screen yet: drives the full striped overlay.
       * Deliberately not `&& isLoading`, which would blink the overlay off
       * during the pre-fetch debounce gap. Excludes `error` so error UI and
       * loading UI never show at once, and `fetchInert` so a display that will
       * never fetch rests instead of spinning on data that is not coming.
       */
      get loading(): boolean {
        return !self.fetchLanded && !self.error && !self.fetchInert
      },
      /**
       * #getter
       * A fetch is running over a stale plot still on screen (zoom, reorder,
       * pan past the buffer): drives a corner indicator rather than the full
       * overlay, so a viewport change does not mask what is drawn.
       */
      get refetching(): boolean {
        return self.isLoading && self.fetchLanded && !self.error
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Off-screen SVG export gate, the shared `computeSvgReady` policy every
       * display runs. Neither comparative display has a `regionTooLarge` state
       * (LOD gates the fetch, not region size). `fetchInert` is the extra
       * terminal, so an export cannot hang on data the autorun will never
       * fetch, and `fetchCanceled` is terminal for the same reason: durable
       * until Retry, and an export presses nothing. The data half waits out an
       * in-flight same-key retry (`!refetching`) and a stale plot
       * (`dataCurrent`).
       */
      get svgReady(): boolean {
        return computeSvgReady(
          {
            error: self.error,
            regionTooLarge: false,
            extraTerminal: self.fetchInert,
            fetchCanceled: self.fetchCanceled,
          },
          () => self.hasDrawable && !self.refetching && self.dataCurrent,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAssembliesSwapped(arg: boolean) {
        self.assembliesSwapped = arg
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
