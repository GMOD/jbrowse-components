/**
 * The mutually-exclusive visual state of a GPU display. Computing it in one
 * place means the precedence — renderError > tooLarge > error > canceled >
 * loading > ready — lives in a single function instead of being re-encoded by
 * subtraction (`&& !regionTooLarge && !error && !renderError`) in every display
 * model AND mirrored a second time by `DisplayChrome`'s JSX order.
 *
 * `renderError` and `tooLarge` replace the whole display subtree (their own
 * root element, so the transition unmounts the canvas → `canvasRef(null)` →
 * `backend.dispose()`). `error`, `canceled` and `loading` are overlays rendered
 * *over* the still-mounted canvas, so they share the `ready` branch's root.
 *
 * `loading` is the one phase that means work is outstanding: every reader
 * asking "is it finished" (`AppReadyMarker`, `jb.waitReady`, the capture waits)
 * treats every other phase as finished. `canceled` is the user's standing stop,
 * durable until Retry (or, on the LGV families, a viewport change); the chrome
 * draws it as the loading overlay in its canceled state, which carries Retry.
 */
export type DisplayPhase = 'renderError' | DisplayStatusPhase

/**
 * The phases a display without a rendering backend can be in — every phase
 * except the one that reports a backend failure. Its own type because
 * `renderError` is the only phase whose UI needs something no model can supply
 * (the backend hook's `retry()`), which is exactly the line between the shared
 * status chrome and the GPU chrome wrapped around it: `DisplayStatusChrome`
 * takes this, `DisplayChrome` takes the wider union and peels off `renderError`
 * before delegating.
 */
export type DisplayStatusPhase = 'tooLarge' | 'error' | DisplayActivityPhase

/**
 * What is left once no failure terminal holds, as `computeActivityPhase`
 * answers it for every fetching family.
 */
export type DisplayActivityPhase = 'canceled' | 'loading' | 'ready'

export interface DisplayStatusPhaseInputs {
  regionTooLarge: boolean
  error: unknown
}

export interface DisplayPhaseInputs extends DisplayStatusPhaseInputs {
  renderError: unknown
}

/**
 * The terminal precedence shared by every display, over the display's own
 * activity phase.
 *
 * `activity` is a **thunk**, evaluated only after the three failure terminals
 * are ruled out. Load-bearing for MobX: the activity condition typically reads
 * the containing view (`visibleRegions`, `loadedRegions`, …), and evaluating it
 * eagerly would subscribe every reader of `displayPhase` to that churn even
 * while a banner is up — and `DisplayChrome`'s observer, re-firing during a
 * terminal state, then fails to commit the banner subtree (see
 * DisplayChrome.tsx).
 */
export function computeDisplayPhase(
  { renderError, regionTooLarge, error }: DisplayPhaseInputs,
  activity: () => DisplayActivityPhase,
): DisplayPhase {
  return renderError
    ? 'renderError'
    : computeDisplayStatusPhase({ regionTooLarge, error }, activity)
}

/**
 * The terms the activity phase is built from, minus the thunks. All cheap flags
 * on the display itself, so they are read eagerly the same way
 * `computeDisplayPhase` reads its terminals.
 */
export interface DisplayActivityInputs {
  /**
   * The containing track is minimized. Every fetch gate skips a minimized
   * track and its canvas is unmounted, so nothing the terms below wait on can
   * arrive. Suppresses them all, like `fetchInert`, which a subclass overrides
   * outright and so cannot carry it.
   */
  isMinimized: boolean
  /**
   * The display is deliberately showing a static message instead of data
   * (sequence past base resolution, LD with the triangle off). Suppresses every
   * term below, a standing cancel included — which is why `rendersCanvas: false`
   * is not a substitute: that one drops the pre-first-paint term alone.
   */
  fetchInert: boolean
  /**
   * The view holds no content block (`showAllRegions` over a region set whose
   * every member falls under `minimumBlockWidth`; see `viewportEmpty`), so no
   * fetch is issued and `canvasDrawn` is never set. Suppresses every term below.
   */
  viewportEmpty: boolean
  /** a fetch is in flight */
  isLoading: boolean
  /**
   * The user canceled a fetch and has not retried. Outranks every loading term,
   * since what those wait on is the fetch the user stopped. Kept apart from
   * `isLoading` because a cancel is finished, not pending: folded into the
   * loading term, a canceled display read `loading` until Retry and parked every
   * readiness gate on it.
   */
  fetchCanceled: boolean
  /**
   * A load this display depends on beyond its primary fetch has not landed for
   * the first time (multi-way synteny's lane genes and links). A loading term
   * rather than a `dataSuperseded` fold: that flag holds the export through
   * every later refetch too, and a scrim over lanes already drawn is the thing
   * a display saying this wants to avoid.
   */
  awaitingDependentData: boolean
  /**
   * Whether this display paints a canvas in its current configuration. Gates
   * the pre-first-paint term alone, because a display showing a deliberate
   * non-canvas placeholder (LD with the triangle off) never flips `canvasDrawn`.
   */
  rendersCanvas: boolean
  /** first paint has happened */
  canvasDrawn: boolean
}

/**
 * The activity phase, expressed once for every fetching display family, so a
 * term added here reaches every display. The two LGV families hand-wrote it
 * until they had drifted on the cancel term and on which suppression hook each
 * carried.
 *
 * `viewportCurrent` is a **thunk** for the MobX reason `computeDisplayPhase`'s
 * `activity` is: it reads the containing view, while the flags above are on the
 * display. Per-region passes its staleness predicate, global `() => true` (it
 * keeps the last frame up through a refetch rather than scrimming).
 *
 * `hostMounted` is a thunk for the same reason, and gates the **pre-first-paint
 * term only**. `ViewContainer` mounts an off-screen view's body lazily, so its
 * display has no canvas and `!canvasDrawn` could never resolve — which parked
 * `[data-app-phase="ready"]` for the whole app. It is required on every view and
 * host contract rather than defaulted there, so a stand-in has to state it and
 * cannot excuse the first paint by omission. The fetch terms stay live while unmounted: an
 * off-screen display still fetches, and during cold load `visible` is false
 * until the IntersectionObserver's first callback.
 */
export function computeActivityPhase(
  {
    isMinimized,
    fetchInert,
    viewportEmpty,
    isLoading,
    fetchCanceled,
    awaitingDependentData,
    rendersCanvas,
    canvasDrawn,
  }: DisplayActivityInputs,
  viewportCurrent: () => boolean,
  hostMounted: () => boolean = () => true,
): DisplayActivityPhase {
  return isMinimized || fetchInert || viewportEmpty
    ? 'ready'
    : fetchCanceled
      ? 'canceled'
      : isLoading ||
          awaitingDependentData ||
          (rendersCanvas && hostMounted() && !canvasDrawn) ||
          !viewportCurrent()
        ? 'loading'
        : 'ready'
}

/**
 * The same ranking minus `renderError`, for a display with no rendering backend
 * to fail (arc's main-thread SVG). `computeDisplayPhase` delegates here, so the
 * order lives in one place.
 */
export function computeDisplayStatusPhase(
  { regionTooLarge, error }: DisplayStatusPhaseInputs,
  activity: () => DisplayActivityPhase,
): DisplayStatusPhase {
  return regionTooLarge ? 'tooLarge' : error ? 'error' : activity()
}
