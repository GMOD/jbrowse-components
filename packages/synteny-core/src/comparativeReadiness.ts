import {
  computeDisplayStatusPhase,
  computeLoadingTerm,
} from '@jbrowse/render-core/displayPhase'

import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// Readiness for the two comparative views, which answer it differently from
// every other display and had answered it twice. ADR-076.
//
// The difference is the SHARED CANVAS: a dotplot's plot rect and a synteny
// level's band are one surface that several displays draw onto, so paint is a
// property of the surface while freshness is a property of each display. An LGV
// display owns both and `RenderLifecycleMixin` gives it both; here they live on
// different models, and every reader that wanted "is this finished" rejoined
// them itself.
//
// Three answers come out of that join, and the first two are deliberately not
// the same predicate — the same split `data-display-phase` and
// `data-display-drawn` already make for LGV (ADR-065):
//
// - `comparativeDisplayPhase` — is this display still WORKING? An error is a
//   finished state, so the app is ready over it. Feeds `displayPhase`, and
//   through it `AppReadyMarker`.
// - `comparativeSurfaceSettled` — is there FINISHED CONTENT on this canvas? An
//   error is not content, so this stays false and a capture fails loudly rather
//   than committing a picture of the banner. Feeds each view's `settled`, and
//   through it `data-display-drawn`.
// - `comparativeSurfacePhase` — the first question asked of the whole surface,
//   for the `data-display-phase` its one canvas publishes.

/**
 * The shared canvas, as its displays and its own `settled` gate see it. Both
 * views publish it as `surfaceReadiness`, so a display reads one field instead
 * of walking to the level for paint and on to the view for the init flags.
 */
export interface ComparativeSurface {
  /**
   * First paint, through `RenderLifecycleMixin.painted` rather than the raw
   * `canvasDrawn` — the answer that stays true for a surface that deliberately
   * paints nothing.
   */
  painted: boolean
  /**
   * An `init` blob not yet applied. A level exists from the moment its rows do,
   * but init adds the synteny tracks several awaits later, so an empty surface
   * paints a cleared canvas, calls that drawn, and would settle vacuously over
   * its zero displays.
   */
  initPending: boolean
  /**
   * A reorder this init asked for that has not succeeded. What is on screen is
   * the pre-reorder hairball, not the answer — see `DiagonalizeProgressMixin`,
   * which raises it deliberately so a capture times out instead of committing
   * one.
   */
  pendingAutoDiagonalize: boolean
  /**
   * The backend failed to initialize or was lost, from
   * `RenderLifecycleMixin.renderError` on the model that owns the canvas.
   *
   * Terminal, and the reason this is a term at all: on a WebGL2 context-ceiling
   * eviction the banner renders but `painted` never becomes true, so a phase
   * computed from the loading term alone said `loading` forever. Every
   * `data-app-phase` wait then burned its full timeout on a surface that had
   * already given up.
   */
  renderError: unknown
  /**
   * Whether the container has this surface's view body in the DOM.
   *
   * The same hole `renderError` above covers, reached the other way: a view
   * below the fold is not mounted (`ViewContainer` lazy-mounts to stay under the
   * WebGL2 context ceiling), so there is no canvas, `painted` never becomes
   * true, and the phase said `loading` until the user happened to scroll to it —
   * parking `[data-app-phase="ready"]` for the whole app on a view nobody was
   * looking at.
   *
   * Gates the paint term only. A surface still fetching while off screen
   * reports `loading`, which is true and is what stops a readiness gate firing
   * over work in flight.
   */
  hostMounted: boolean
}

/**
 * One comparative display's fetch state, as its readiness is computed from —
 * `FetchMixin`'s and `KeyedFetchMixin`'s members under their own names, so a
 * display passes itself.
 */
export interface ComparativeDisplayFetchState {
  error: unknown
  /**
   * The states where the fetch autorun deliberately never runs, so no data is
   * coming — minimized, or a level whose two rows aren't both showing regions.
   */
  fetchInert: boolean
  /**
   * A fetch is in flight, or the user canceled one — never a bare `isLoading`,
   * for the reason `computeLoadingTerm` gives: the cancel drops the stop token
   * synchronously, and the overlay carrying Retry unmounts on `ready`.
   */
  isLoadingOrCanceled: boolean
  /** the drawn data was fetched for the view's current inputs */
  dataCurrent: boolean
}

/**
 * The display's own mutually-exclusive state, ranked the way every other
 * display's is.
 *
 * `computeDisplayStatusPhase` and `computeLoadingTerm` rather than a hand-written
 * conjunction, and each term goes where its documented meaning puts it:
 * `fetchInert` and `isLoadingOrCanceled` are the same fields
 * `computeLoadingTerm` reads on an LGV display (a display drawing nothing by
 * design gets no scrim and no wait; a canceled load keeps its overlay), and
 * the surface supplies first paint plus the two "what is on screen is not the
 * answer" flags through the `viewportCurrent` thunk. Neither view has a
 * `regionTooLarge` state — synteny never gates on region size and dotplot gates
 * on LOD — so the terminal ranking reduces to error over loading over ready.
 *
 * `DisplayStatusPhase`, not `DisplayPhase`: neither display owns a rendering
 * backend of its own (the surface does), so neither can claim `renderError` in
 * the sense that matters to the banner, whose `retry()` no display can supply.
 *
 * It still REPORTS one. A surface that failed to initialize will never paint,
 * so a display drawing onto it is in a terminal state, not a loading one — the
 * loading term reads `canvasDrawn: false` and would answer `loading` until the
 * tab closed. Ranked first, like `computeDisplayPhase` ranks it on the LGV side.
 */
export function comparativeDisplayPhase(
  display: ComparativeDisplayFetchState,
  surface: ComparativeSurface,
): DisplayStatusPhase {
  if (surface.renderError) {
    return 'error'
  }
  return computeDisplayStatusPhase(
    { regionTooLarge: false, error: display.error },
    () =>
      computeLoadingTerm(
        {
          fetchInert: display.fetchInert,
          // an LGV term: this family's displays draw onto a shared comparative
          // surface whose extent is the two views' whole span, not a block set
          // that can empty out from under them
          viewportEmpty: false,
          isLoadingOrCanceled: display.isLoadingOrCanceled,
          awaitingDependentData: false,
          rendersCanvas: true,
          canvasDrawn: surface.painted,
        },
        () =>
          display.dataCurrent &&
          !surface.initPending &&
          !surface.pendingAutoDiagonalize,
        () => surface.hostMounted,
      ),
  )
}

/**
 * The surface's own phase, for the `data-display-phase` its canvas publishes.
 *
 * A shared canvas cannot carry one display's phase, so it carries the ranking
 * over all of them — the same order `computeDisplayStatusPhase` uses, since an
 * error on any ribbon is the thing a reader most needs to see and a fetch still
 * running is the thing a wait most needs to see.
 *
 * That attribute is what makes the DOM-level doneness waits work here at all.
 * `[data-display-phase="loading"]` is what `waitForDisplayPhases` and the busy
 * selector in `@jbrowse/capture` key on, and on a comparative page they were
 * assertions about a selector no element published — satisfied by a canvas that
 * had not begun.
 *
 * A surface with no displays answers off `initPending` alone: a level whose
 * tracks init has yet to add is still assembling, and one that legitimately has
 * none is done.
 */
export function comparativeSurfacePhase(
  surface: ComparativeSurface,
  displays: ComparativeDisplayFetchState[],
): DisplayStatusPhase {
  if (displays.length === 0) {
    return surface.renderError
      ? 'error'
      : surface.initPending
        ? 'loading'
        : 'ready'
  }
  const phases = new Set(displays.map(d => comparativeDisplayPhase(d, surface)))
  return phases.has('error')
    ? 'error'
    : phases.has('loading')
      ? 'loading'
      : 'ready'
}

// The display half of both views' `settled` gate, written once so the two
// can't drift on what "done" means. `dataCurrent` is what makes it a done test
// rather than a not-busy test: in the debounce gap after a region/zoom change
// the held data is stale yet no fetch is in flight, so the loading flag alone
// would report done on content drawn against the old viewport.
//
// `fetchInert` short-circuits that, and must: a display that will never fetch
// can never set `loadedFetchKey`, so `dataCurrent` is false forever and the
// whole view would never settle on account of a display that is drawing nothing
// by design. Same terminal-state rule the SVG export's `extraTerminal` and the
// loading overlay already answer off that one getter.
//
// **An error is NOT terminal here**, and that is the one place this parts
// company with `comparativeDisplayPhase` and with `computeSvgReady`. Those two
// let a failed display finish; this one holds the gate shut, because
// `data-display-drawn` is what the screenshot generator and the browser tests
// wait on, and a golden regenerated during an outage would otherwise absorb the
// error banner as expected output instead of failing the run.
//
// Vacuously true on an empty list, which is correct for a level or axis that
// legitimately has no display — `comparativeSurfaceSettled` gates on
// `initPending` for the window where init has yet to add them.
export function displaysSettled(
  displays: Pick<
    ComparativeDisplayFetchState,
    'isLoadingOrCanceled' | 'dataCurrent' | 'fetchInert'
  >[],
) {
  return displays.every(
    d => d.fetchInert || (!d.isLoadingOrCanceled && d.dataCurrent),
  )
}

/**
 * The whole `settled` gate: finished content on the canvas, for a surface and
 * the displays drawing onto it.
 *
 * Both views' `settled` getters were this conjunction spelled out separately,
 * which is how the two comments describing it drifted into describing different
 * things. Drives `synteny_canvas` / `dotplot_webgl_canvas`'s
 * `data-display-drawn`, so it must mean "done", not just "first paint".
 */
export function comparativeSurfaceSettled(
  surface: ComparativeSurface,
  displays: Parameters<typeof displaysSettled>[0],
) {
  return (
    surface.painted &&
    !surface.initPending &&
    !surface.pendingAutoDiagonalize &&
    displaysSettled(displays)
  )
}
