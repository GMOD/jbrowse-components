import { computeSvgReady } from '@jbrowse/core/svg/svgReady'
import { isDataCurrent } from '@jbrowse/core/util'
import { adapterConfigKey } from '@jbrowse/core/util/adapterConfigKey'

/**
 * What a comparative display's own fetch state looks like: the terms the flags
 * below are built from, plus the inputs of the freshness compare. Named the
 * same on both displays, which is what lets one function serve them.
 */
export interface ComparativeFetchInputs {
  /**
   * A fetch has completed — data is present, even if it mapped zero features.
   * Not a feature-count test: an empty-but-finished fetch is ready, or an empty
   * plot spins its overlay forever.
   */
  ready: boolean
  /**
   * The display holds something an SVG export can draw. Synteny answers with
   * `ready`; the dotplot answers with `instanceData` rather than its `geometry`
   * computed, because `svgReady` is polled outside any reactive context and a
   * `geometry` read there recolors every segment per poll.
   */
  hasDrawable: boolean
  /** an RPC is in flight */
  fetching: boolean
  error: unknown
  /** `SyntenyFetchStateMixin`'s hook, and the display's override of it */
  fetchInert: boolean
  /** `SyntenyFetchStateMixin`'s durable Cancel flag */
  fetchCanceled: boolean
  /**
   * the key the data on screen was fetched for — `comparativeFetchKey`'s
   * output, stamped by `installComparativeFetchAutorun` at commit
   */
  loadedFetchKey: string | undefined
  /** the display's half of the key a fetch issued right now would use */
  currentFetchKey: string
  /** the other half: the adapter that fetch would run against */
  adapterConfig: Record<string, unknown>
}

/**
 * The whole key a comparative fetch is issued under: the display's own
 * `currentFetchKey` plus the adapter axis. The installer reads it to gate and
 * stamp, `dataCurrent` below reads it to compare, so the two cannot carry
 * different axes. They did: the installer folded the adapter in for itself and
 * `dataCurrent` compared the display's key alone, so an adapter edit refetched
 * while the export gate held the stale plot current.
 */
export function comparativeFetchKey(
  self: Pick<ComparativeFetchInputs, 'currentFetchKey' | 'adapterConfig'>,
) {
  return `${self.currentFetchKey}\n${adapterConfigKey(self.adapterConfig)}`
}

/** The four flags every consumer of a comparative display reads. */
export interface ComparativeFetchFlags {
  loading: boolean
  refetching: boolean
  dataCurrent: boolean
  svgReady: boolean
}

/**
 * The four fetch flags a comparative display publishes, from its own fetch
 * state.
 *
 * `LinearSyntenyDisplay` and `DotplotDisplay` had these as six one-line
 * getters, character-identical in pairs.
 * [ADR-054](../../../agent-docs/architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
 * §4 left them display-local on the grounds that `loading` genuinely differed —
 * synteny subtracted `fetchInert` and the dotplot had no inert state to
 * subtract. What closed that is the HOOK, not the state: `fetchInert` reached
 * `SyntenyFetchStateMixin` with a default of `false`, so both displays spell one
 * expression while the dotplot's inert term stays constant (it declares no
 * override, and the mixin's own comment says "Dotplot leaves it"). With the
 * term spellable in both, the six getters were character-identical in pairs,
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
 * - `svgReady` — the off-screen export gate, the shared `computeSvgReady`
 *   policy every display runs. Neither display has a `regionTooLarge` state
 *   (LOD gates the fetch, not region size). `fetchInert` is the extra
 *   terminal, so an export can't hang on data the autorun will never fetch,
 *   and `fetchCanceled` is terminal for the same reason: durable until Retry,
 *   and an export presses nothing. The data half waits out an in-flight
 *   same-key retry (`!refetching`) and a stale plot (`dataCurrent`).
 */
export function comparativeFetchFlags(
  self: ComparativeFetchInputs,
): ComparativeFetchFlags {
  const refetching = self.fetching && self.ready && !self.error
  const dataCurrent = isDataCurrent(
    self.loadedFetchKey,
    comparativeFetchKey(self),
  )
  return {
    loading: !self.ready && !self.error && !self.fetchInert,
    refetching,
    dataCurrent,
    svgReady: computeSvgReady(
      {
        error: self.error,
        regionTooLarge: false,
        extraTerminal: self.fetchInert,
        fetchCanceled: self.fetchCanceled,
      },
      () => self.hasDrawable && !refetching && dataCurrent,
    ),
  }
}
