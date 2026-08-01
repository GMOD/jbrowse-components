import { types } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SyntenyFetchStateMixin
 * #category display
 *
 * The fetch-lifecycle bookkeeping shared by the two comparative displays
 * (LinearSyntenyDisplay, DotplotDisplay): whether an RPC is in flight, the
 * signature of the inputs the held data was fetched for, and the one-shot
 * reversed-assembly flag.
 *
 * Composed rather than duplicated so the two displays can't drift on what
 * "loading" versus "refetching" means — the difference decides whether the user
 * gets a full overlay or a corner spinner, and both views' `settled` gate (the
 * one screenshot capture waits on) is written against these same three pieces.
 *
 * `loading`/`refetching`/`dataCurrent` themselves stay on each display: they
 * need `ready` (which display holds its data in a different field) and
 * `currentFetchKey` (whose inputs are view-specific), neither of which an
 * empty-model mixin can see. The three are one-liners over what's here, written
 * identically in both.
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
    }))
}

// The display half of both views' `settled` gate, written once so the two
// can't drift on what "done" means. `dataCurrent` is what makes it a done test
// rather than a not-busy test: in the debounce gap after a region/zoom change
// the held data is stale yet no fetch is in flight, so loading/refetching alone
// would report done on content drawn against the old viewport.
//
// Vacuously true on an empty list, which is correct for a level or axis that
// legitimately has no display — the caller is responsible for not asking while
// its init has yet to add them (both gate on `initPending` for that).
export function displaysSettled(
  displays: { loading: boolean; refetching: boolean; dataCurrent: boolean }[],
) {
  return displays.every(d => !d.loading && !d.refetching && d.dataCurrent)
}

// Both displays detect the same misconfiguration — the file's chromosome names
// match the opposite axis/row — so they must say the same thing about it. Only
// the remedy differs (which control the user reaches for), so the caller
// supplies that and the diagnosis is written once.
export function swappedAssembliesWarning(effect: string) {
  return {
    message: 'The assemblies appear to be in the wrong order',
    effect,
  }
}
