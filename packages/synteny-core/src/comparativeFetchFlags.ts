import { isDataCurrent } from '@jbrowse/core/util'

/**
 * What a comparative display's own fetch state looks like: the four terms the
 * flags below are built from, plus the two fetch keys the freshness compare
 * reads. Named the same on both displays, which is what lets one function serve
 * them.
 */
export interface ComparativeFetchInputs {
  /**
   * A fetch has completed — data is present, even if it mapped zero features.
   * Not a feature-count test: an empty-but-finished fetch is ready, or an empty
   * plot spins its overlay forever.
   */
  ready: boolean
  /** an RPC is in flight */
  fetching: boolean
  error: unknown
  /** `SyntenyFetchStateMixin`'s hook, and the display's override of it */
  fetchInert: boolean
  /** the key the data on screen was fetched for */
  loadedFetchKey: string | undefined
  /** the key a fetch issued right now would use */
  currentFetchKey: string
}

/** The three flags every consumer of a comparative display reads. */
export interface ComparativeFetchFlags {
  loading: boolean
  refetching: boolean
  dataCurrent: boolean
}

/**
 * The three fetch flags a comparative display publishes, from its own fetch
 * state.
 *
 * `LinearSyntenyDisplay` and `DotplotDisplay` had these as six one-line
 * getters, character-identical in pairs.
 * [ADR-054](../../../agent-docs/architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
 * §4 left them display-local on the grounds that `loading` genuinely differed —
 * synteny subtracted `fetchInert` and the dotplot had no inert state to
 * subtract. The dotplot has one now, so the last term that differed doesn't,
 * and a plain function is the shape that ADR prescribes for shared policy at
 * this level.
 *
 * - `loading` — first load, nothing on screen yet. Deliberately not
 *   `&& fetching`, which would blink the overlay off during the pre-fetch
 *   debounce gap. Excludes `error` so error UI and loading UI never show at
 *   once, and `fetchInert` so a display that will never fetch rests instead of
 *   spinning on data that is not coming.
 * - `refetching` — a fetch is running over a stale plot still on screen (zoom,
 *   reorder, pan past the buffer). Drives a corner indicator rather than the
 *   full overlay, so a viewport change doesn't mask what is drawn.
 * - `dataCurrent` — the drawn data was fetched for the view's current inputs.
 *   Goes false the instant a zoom or reorder changes them, *before* the
 *   debounced refetch begins, which is the gap `refetching` alone cannot see
 *   and the reason a done-gate can't be written off the other two.
 */
export function comparativeFetchFlags(
  self: ComparativeFetchInputs,
): ComparativeFetchFlags {
  return {
    loading: !self.ready && !self.error && !self.fetchInert,
    refetching: self.fetching && self.ready && !self.error,
    dataCurrent: isDataCurrent(self.loadedFetchKey, self.currentFetchKey),
  }
}
