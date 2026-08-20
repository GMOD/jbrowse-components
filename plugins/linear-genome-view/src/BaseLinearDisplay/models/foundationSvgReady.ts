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
 */
export function foundationSvgReady(self: SvgReadyFoundation): boolean {
  return computeSvgReady(
    {
      error: self.error,
      regionTooLarge: self.regionTooLarge,
      extraTerminal: self.fetchInert,
    },
    () => self.dataCurrent,
  )
}
