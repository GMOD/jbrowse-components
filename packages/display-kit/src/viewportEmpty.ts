/**
 * Nothing on screen for this display to fetch or draw: the view holds no
 * content block, so there is no region to ask a worker about and no span to
 * paint.
 *
 * **One way in, and it is worth knowing how narrow it is.** A region elides
 * below `minimumBlockWidth` (3px), so with the whole set on screen every region
 * has to be under `1/267` of it — i.e. `showAllRegions` on a region set of
 * roughly 270+ similarly-sized members, which is a scaffold-level assembly and
 * not much else. Scrolling cannot reach this state: the view clamps `offsetPx`
 * to the region extent, and an inter-region padding span is a few pixels wide,
 * so the viewport always overlaps content. Verified, after this doc first
 * claimed otherwise.
 *
 * **A resting state, and therefore a terminal one.** No fetch has anything to
 * ask for, so `dataCurrent` can never flip and `canvasDrawn` can never be set —
 * which without this term leaves every display in the view under a permanent
 * loading scrim, and hangs the whole view's SVG export on `awaitSvgReady`'s
 * unbounded `when`. Both LGV foundations declare it over this one expression and
 * feed it to every answer a display gives about being finished: the loading term
 * (`computeLoadingTerm`), the export gate (`foundationSvgReady`'s freshness
 * thunk, not its eager terminals — this is a view read), `paintInert`, which is
 * what the on-screen capture gate waits on, and the retry contract check, whose
 * dead-Retry report would otherwise fire on every display in the view at once
 * and name a fix that does not exist.
 *
 * `false` before the view is measured: there the answer is "not known yet"
 * rather than "nothing", and `hasVisibleContent` reads `dynamicBlocks`, which
 * throws by design until then.
 */
export function viewportEmpty(host: {
  initialized: boolean
  hasVisibleContent: boolean
}) {
  return host.initialized && !host.hasVisibleContent
}
