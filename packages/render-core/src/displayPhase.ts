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
