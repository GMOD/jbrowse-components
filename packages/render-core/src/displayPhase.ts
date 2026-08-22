/**
 * The mutually-exclusive visual state of a GPU display. Computing it in one
 * place means the precedence — renderError > tooLarge > error > loading > ready
 * — lives in a single function instead of being re-encoded by subtraction
 * (`&& !regionTooLarge && !error && !renderError`) in every display model AND
 * mirrored a second time by `DisplayChrome`'s JSX order. `DisplayChrome`
 * switches on it; the loading scrim's visibility is just
 * `displayPhase === 'loading'`, computed once in the chrome.
 *
 * `renderError` and `tooLarge` replace the whole display subtree (their own
 * root element, so the transition unmounts the canvas → `canvasRef(null)` →
 * `backend.dispose()`). `error` and `loading` are overlays rendered *over* the
 * still-mounted canvas, so they share the `ready` branch's root.
 */
export type DisplayPhase = 'renderError' | DisplayStatusPhase

/**
 * The phases a display without a rendering backend can be in — every phase
 * except the one that reports a backend failure. Its own type because
 * `renderError` is the only phase whose UI needs something no model can supply
 * (the backend hook's `retry()`), which is exactly the line between the shared
 * status chrome and the GPU chrome wrapped around it: `DisplayStatusChrome`
 * takes this, `DisplayChrome` takes the wider union and peels off `renderError`
 * before delegating. A main-thread SVG display (arc) computes this one and is
 * then *unable* to claim a phase whose banner has no retry to offer.
 */
export type DisplayStatusPhase = 'tooLarge' | 'error' | 'loading' | 'ready'

export interface DisplayStatusPhaseInputs {
  regionTooLarge: boolean
  error: unknown
}

export interface DisplayPhaseInputs extends DisplayStatusPhaseInputs {
  renderError: unknown
}

/**
 * `loading` is the only display-specific axis: MultiRegion passes
 * "!isReady || stale viewport", Global passes "fetch in flight", sequence
 * layers a zoom gate on top. The terminal precedence above it is identical for
 * every display, so it lives here — pass the display's loading condition and
 * get the resolved phase back.
 *
 * `loading` is a **thunk**, evaluated only after the three terminal states are
 * ruled out. This is load-bearing for MobX, not a micro-optimization: the
 * loading condition typically reads the containing view (`visibleRegions`,
 * `loadedRegions`, …), a large reactive dependency set. Evaluating it eagerly
 * would make every reader of `displayPhase` subscribe to all of it even while a
 * banner is up — and `DisplayChrome`'s observer, re-firing on that churn during
 * a terminal state, then fails to commit the banner subtree to the DOM (the
 * React-reconciliation hazard documented in DisplayChrome.tsx). Short-circuiting
 * keeps the tracked set to just the terminal flags when one is active, matching
 * the old direct-read early-returns.
 */
export function computeDisplayPhase(
  { renderError, regionTooLarge, error }: DisplayPhaseInputs,
  loading: () => boolean,
): DisplayPhase {
  return renderError
    ? 'renderError'
    : computeDisplayStatusPhase({ regionTooLarge, error }, loading)
}

/**
 * The five terms the `loading` condition is built from, minus the one that is a
 * thunk. All cheap flags on the display itself, so they are read eagerly the
 * same way `computeDisplayPhase` reads its terminals.
 */
export interface DisplayLoadingInputs {
  /**
   * The display is deliberately showing a static message instead of data
   * (sequence past base resolution, LD with the triangle off), so no scrim at
   * all. Suppresses every term below — which is why `rendersCanvas: false` is
   * not a substitute: that one drops the pre-first-paint term alone, leaving the
   * fetch terms free to scrim over the placeholder, and `isLoadingOrCanceled`
   * includes a cancel that is deliberately durable.
   */
  fetchInert: boolean
  /**
   * The view holds no content block, so there is nothing to fetch and nothing
   * to paint: `showAllRegions` over a region set whose every member falls under
   * `minimumBlockWidth`, which is a scaffold-level assembly and little else (see
   * `viewportEmpty`). Suppresses every term below for the same reason
   * `fetchInert` does, and it is the pre-first-paint one that makes it
   * necessary: no fetch is issued, so `canvasDrawn` is never set and the scrim
   * would sit there for as long as the viewport stays off content.
   */
  viewportEmpty: boolean
  /**
   * A fetch is in flight, or the user canceled one. **Never a bare
   * `isLoading`**: cancel drops the stop token synchronously, so without the
   * second term the phase falls to `ready` and the overlay carrying the Retry
   * button unmounts, leaving the display stopped and empty with nothing to
   * click.
   */
  isLoadingOrCanceled: boolean
  /**
   * Whether this display paints a canvas in its current configuration. Gates
   * the pre-first-paint term alone, because a display that is showing a
   * deliberate non-canvas placeholder (LD with the triangle off) never flips
   * `canvasDrawn` and would sit under the scrim forever.
   */
  rendersCanvas: boolean
  /** first paint has happened */
  canvasDrawn: boolean
}

/**
 * The `loading` term itself — the one axis `computeDisplayPhase` leaves to its
 * caller — expressed once for both LGV display families.
 *
 * It was two hand-written expressions, and they had already drifted apart in
 * three ways that were equivalent only by accident: the per-region family spelled
 * the cancel term out by hand (`!isReady || … || fetchCanceled`, over a bare
 * `isLoading`) rather than reading `isLoadingOrCanceled`, and each family carried
 * exactly one of the two suppression hooks — `fetchInert` on per-region,
 * `rendersCanvas` on global — so a display in the other family could express its
 * case only by overriding `displayPhase`, which is the thing both hooks exist to
 * prevent. Single-sourcing the expression is the same argument the precedence
 * above already won, one level down: a term added here reaches every display,
 * instead of reaching whichever family the author happened to be reading.
 *
 * The four inputs all now live on a mixin every foundation composes —
 * `fetchInert` / `isLoadingOrCanceled` on `FetchMixin`, `rendersCanvas` /
 * `canvasDrawn` on `RenderLifecycleMixin` — so `foundationDisplayPhase` passes
 * the model straight through and the only thing a family supplies is
 * `viewportCurrent`: per-region its staleness predicate, global `() => true` (it
 * keeps the last frame up through a refetch rather than scrimming). Two hooks
 * used to be hard-coded per family instead, which is how the second drift
 * happened after the first was fixed — LD needed `fetchInert` and the
 * global family did not have it.
 *
 * `viewportCurrent` is a **thunk** for the same MobX reason `computeDisplayPhase`'s
 * `loading` is, and it is the only term that needs to be: it reads the containing
 * view (`visibleRegions`, `loadedRegions`), while the four inputs above are flags
 * on the display itself. Short-circuiting keeps a suppressed or already-loading
 * display from subscribing to viewport churn.
 */
export function computeLoadingTerm(
  {
    fetchInert,
    viewportEmpty,
    isLoadingOrCanceled,
    rendersCanvas,
    canvasDrawn,
  }: DisplayLoadingInputs,
  viewportCurrent: () => boolean,
): boolean {
  return (
    !fetchInert &&
    !viewportEmpty &&
    (isLoadingOrCanceled ||
      (rendersCanvas && !canvasDrawn) ||
      !viewportCurrent())
  )
}

/**
 * The same ranking minus `renderError`, for a display with no rendering backend
 * to fail (arc's main-thread SVG). `computeDisplayPhase` delegates here rather
 * than restating the tail, so there is still exactly one place the order lives —
 * and the narrower return type is what lets `DisplayStatusChrome` accept a
 * backend-less display without either a cast or a dead branch.
 *
 * `loading` is a thunk here for the same reason as above.
 */
export function computeDisplayStatusPhase(
  { regionTooLarge, error }: DisplayStatusPhaseInputs,
  loading: () => boolean,
): DisplayStatusPhase {
  return regionTooLarge
    ? 'tooLarge'
    : error
      ? 'error'
      : loading()
        ? 'loading'
        : 'ready'
}
