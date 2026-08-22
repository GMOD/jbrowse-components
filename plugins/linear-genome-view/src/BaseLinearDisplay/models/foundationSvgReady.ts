import { computeSvgReady } from '@jbrowse/core/svg/svgReady'

/**
 * What a display foundation must expose for the export gate. Named the same on
 * both foundations, which is what lets one mapping serve them.
 */
export interface SvgReadyFoundation {
  error: unknown
  regionTooLarge: boolean
  /** `FetchMixin`'s: this display will never fetch here, so nothing is coming */
  fetchInert: boolean
  /**
   * `FetchMixin`'s: a standing user cancel. Blocking for the fetch autoruns
   * until Retry or a viewport change, and an export causes neither, so it is a
   * terminal here — `awaitSvgReady` fails the export on it, matching the
   * "Loading canceled / Retry" the user sees on screen
   */
  fetchCanceled: boolean
  /** the foundation's: no content block is on screen — see `viewportEmpty` */
  viewportEmpty: boolean
  /** the family's own freshness answer */
  dataCurrent: boolean
}

/**
 * `svgReady` for a display foundation: the shared policy (`computeSvgReady`)
 * with this codebase's foundation field names mapped onto it.
 *
 * `computeSvgReady` already single-sources the *policy* — the terminals that let
 * an export proceed with no data, and the laziness of the freshness read. What
 * it does not single-source is the **mapping**, and that mapping was the last
 * copy: `MultiRegionDisplayMixin` and `GlobalFetchMixin` each wrote the same
 * four fields into it, so a fifth terminal would have had to be remembered
 * twice. That is the failure mode `computeSvgReady`'s own header describes
 * (each hand-written copy it replaced was one place to forget a terminal and
 * hang the export), surviving one level down.
 *
 * `dataCurrent` is read through a thunk here, so it stays behind the terminal
 * short-circuit exactly as `computeSvgReady` documents — freshness reads the
 * containing view, and `awaitSvgReady`'s `when()` must not subscribe to that
 * churn while a banner is up.
 *
 * `viewportEmpty` rides in the thunk rather than as a fourth terminal for that
 * same reason — it is a view read, and the non-LGV `computeSvgReady` callers
 * have no view to answer it from — and it belongs to freshness anyway: a
 * viewport holding no content block has nothing it could be stale about, so it
 * is vacuously current. Without it a display parked off content never resolves,
 * and `awaitSvgReady` is an unbounded `when`.
 */
export function foundationSvgReady(self: SvgReadyFoundation): boolean {
  return computeSvgReady(
    {
      error: self.error,
      regionTooLarge: self.regionTooLarge,
      extraTerminal: self.fetchInert,
      fetchCanceled: self.fetchCanceled,
    },
    () => self.viewportEmpty || self.dataCurrent,
  )
}
