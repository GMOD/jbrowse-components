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
export type DisplayPhase =
  | 'renderError'
  | 'tooLarge'
  | 'error'
  | 'loading'
  | 'ready'

export interface DisplayPhaseInputs {
  renderError: unknown
  regionTooLarge: boolean
  error: unknown
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
    : regionTooLarge
      ? 'tooLarge'
      : error
        ? 'error'
        : loading()
          ? 'loading'
          : 'ready'
}
