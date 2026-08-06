import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

export interface RenderingBackendCallbacks<B> {
  upload: (backend: B) => void
  /**
   * Issue draw calls for the current frame. Return `true` if something was
   * actually drawn (flips `canvasDrawn`), `false` to skip this tick
   * (e.g. `renderState` not yet computed). Returning `true` without
   * having drawn — or forgetting a return branch — will flip the
   * `canvasDrawn` flag spuriously, which test selectors and overlay UI
   * depend on.
   */
  render: (backend: B) => boolean
}

/**
 * Owns the GPU draw lifecycle for any display that paints to a canvas.
 *
 * Plugins compose this mixin (directly or via `MultiRegionDisplayMixin` /
 * `GlobalDataDisplayMixin`) and call
 * `self.attachRenderingBackend(backend, { upload, render })` from their own
 * `startRenderingBackend(backend)` action. The mixin owns:
 *
 *  - `canvasDrawn` — observable flag read by test-selector `data-testid` attributes to detect first paint.
 *  - `currentRenderingBackend` — the backend reference, updated on context-loss
 *    recovery. Autoruns read it each tick so they re-fire against the new
 *    one without being reinstalled.
 *  - `renderTick` — counter the render autorun observes; bumped by
 *    `renderNow()` (tab-visibility restore) and after every upload
 *    (ensures render re-fires when an upload happens but renderState
 *    identity stays stable).
 *  - `autorunsInstalled` — guards `attachRenderingBackend` so the autorun
 *    pair is spawned once per model instance, not once per backend
 *    assignment.
 *
 * The `upload` callback runs in one autorun, `render` in another. Inside
 * each, every observable read is auto-tracked by MobX — no getter-layer
 * indirection, no multi-entry config. `render` returns `true` when the
 * backend actually painted content (flips `canvasDrawn`), `false` to skip
 * this tick (e.g. `renderState` not yet computed or no regions loaded).
 *
 * #stateModel RenderLifecycleMixin
 * #category display
 * @see RenderLifecycleMixin.test.ts for the upload/render autorun behavior
 */
export function RenderLifecycleMixin() {
  return types
    .model('RenderLifecycle', {})
    .volatile<{
      canvasDrawn: boolean
      currentRenderingBackend: unknown
      renderTick: number
      autorunsInstalled: boolean
      renderError: unknown
    }>(() => ({
      /**
       * #volatile
       * flips true on first paint; read by test selectors to detect render
       */
      canvasDrawn: false,
      /**
       * #volatile
       * current backend reference, updated on context-loss recovery.
       * Typed `unknown` (not generic `B`) on purpose: this mixin is composed
       * by every display via a non-generic factory, so the per-display backend
       * type `B` isn't known here — it's supplied at `attachRenderingBackend<B>`
       * and narrowed with `as B` inside the autoruns. Don't "fix" the cast.
       */
      currentRenderingBackend: undefined,
      /**
       * #volatile
       * counter the render autorun observes; bumped to force a re-render
       */
      renderTick: 0,
      /**
       * #volatile
       * guards attachRenderingBackend so the autorun pair spawns once per instance
       */
      autorunsInstalled: false,
      /**
       * #volatile
       * the render-backend (GPU/Canvas2D init or context-loss) error, or
       * undefined. Single source of truth for the render-error terminal state:
       * `useRenderingBackend` writes it from the canvas-init mechanism so the
       * model — not React-local hook state — owns every terminal state. Read by
       * `displayPhase` (whose `renderError` term outranks `loading`, suppressing
       * the scrim) and by `DisplayChrome` (shows the retry overlay).
       */
      renderError: undefined,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable precondition (default true): both lifecycle autoruns skip
       * their callback entirely while this is false, so a display never has to
       * open its own `upload`/`render` with a readiness check.
       *
       * The LGV mixins override it with `view.initialized`, because before the
       * view is measured its geometry throws by design (`view.width`, and so
       * `visibleRegions` / `trackWidthPx` with it) and a throw in either callback
       * is routed to `renderError` — surfacing "not measured yet" as the GPU
       * render-error banner. Because it's an observable read inside the autoruns,
       * the pair re-fires the moment it flips. This is the *precondition* axis
       * only: whether any data has arrived stays the render callback's own gate
       * (return `false` to skip a tick), which is why `renderState` getters can
       * be plain resolved values.
       */
      get canRender(): boolean {
        return true
      },

      /**
       * #getter
       * Overridable hook (default true): whether this display paints a canvas
       * in its **current** configuration, as opposed to a deliberate static
       * placeholder (LD with the triangle off, sequence past base resolution —
       * both render a message where the `<canvas>` would go, so `canvasRef` is
       * never called and `canvasDrawn` can never flip).
       *
       * Lives here, beside `canvasDrawn`, because every consumer of "has this
       * display painted" needs the pair — and until 2026-08 each family
       * declared its own copy (per-region hard-coded `true`, global carried the
       * hook for LD), so a display could express the state only to whichever
       * family it happened to compose. See `painted` below for the reader that
       * was missed.
       */
      get rendersCanvas(): boolean {
        return true
      },
    }))
    .views(self => ({
      /**
       * #getter
       * **The first-paint answer every consumer outside the display should
       * read**, `canvasDrawn` being only the raw flag: a display that is
       * deliberately not painting a canvas has finished, and saying otherwise
       * is a lie that never resolves.
       *
       * The two `rendersCanvas: false` states each had three of their four
       * consumers wired by hand — the loading scrim (`rendersCanvas` /
       * `loadingSuppressed`) and the SVG export (`svgReadyExtraTerminal`) —
       * while the fourth, `data-display-drawn`, went on publishing `"false"`
       * forever off the raw flag. That attribute is what `PENDING_DISPLAYS`
       * (`@jbrowse/browser-test-utils`) selects on, so a zoomed-out reference
       * sequence track made every `waitForDisplaysDone` on the page burn its
       * full timeout — silently, since that wait swallows its own. Same shape
       * as `fetchInert` on the comparative side: the reader you forget is the
       * one outside the display, so the display has to publish one name for it.
       */
      get painted(): boolean {
        return self.canvasDrawn || !self.rendersCanvas
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      markCanvasDrawn() {
        if (!self.canvasDrawn) {
          self.canvasDrawn = true
        }
      },
      /**
       * #action
       */
      resetCanvasDrawn() {
        if (self.canvasDrawn) {
          self.canvasDrawn = false
        }
      },
      /**
       * #action
       */
      stopRenderingBackend() {
        self.currentRenderingBackend = undefined
        self.canvasDrawn = false
      },
      /**
       * #action
       */
      renderNow() {
        self.renderTick += 1
      },
      /**
       * #action
       * set/clear the render-backend error. Called by `useRenderingBackend`:
       * with the error when the canvas factory rejects (or context-loss
       * re-init fails), and with `undefined` on successful (re)init and on
       * retry.
       */
      setRenderError(error: unknown) {
        // Reference-identity guard, not value-equality: the render catch passes
        // a fresh Error object per throw, so a repeatedly-failing render still
        // reassigns each time (cosmetic MST churn). Harmless — nothing reads
        // renderError inside a hot autorun — but the guard does dedupe the
        // common set-then-clear-with-same-value (undefined) transitions.
        if (self.renderError !== error) {
          self.renderError = error
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * attach a GPU/Canvas2D backend and install the upload + render autorun
       * pair (idempotent — re-calling only swaps the backend)
       */
      // `cbs` is captured permanently by the autoruns on first call.
      // Re-calling with a new backend (context-loss recovery) updates
      // `currentRenderingBackend` only — `cbs` from the first call stay in effect.
      attachRenderingBackend<B>(backend: B, cbs: RenderingBackendCallbacks<B>) {
        self.currentRenderingBackend = backend
        if (self.autorunsInstalled) {
          return
        }
        self.autorunsInstalled = true
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentRenderingBackend as B | undefined
              if (b === undefined || !self.canRender) {
                return
              }
              // A throw in the upload callback (malformed worker data, a bad
              // buffer-packing edge case) is routed to `renderError` for the
              // same reason as the render autorun below: an uncaught reaction
              // error would skip `renderNow()`, never flip `canvasDrawn`, and
              // strand the display on 'loading' forever with no retry. Setting
              // `renderError` unmounts the canvas and disposes the backend, so
              // this can't re-fire into a loop.
              try {
                cbs.upload(b)
                // Force the render autorun to re-fire after each upload.
                // Needed when the render callback's observable dependencies
                // stay identity-stable across an upload (e.g. renderState
                // returning undefined before and after the first data
                // arrives because autoscale hasn't resolved). Without this,
                // first paint can be delayed until a user interaction
                // shifts a render dep.
                self.renderNow()
              } catch (e) {
                self.setRenderError(e)
              }
            },
            { name: 'RenderLifecycle:upload' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentRenderingBackend as B | undefined
              void self.renderTick
              if (b === undefined || !self.canRender) {
                return
              }
              // A throw in the render callback (e.g. an invalid render-state
              // input like an empty rendering type) would otherwise escape as
              // an uncaught reaction error and leave the display stuck on
              // "loading" forever. Route it to `renderError` so it surfaces as
              // the render-error overlay (with the message + retry) instead.
              // Setting `renderError` unmounts the canvas and disposes the
              // backend, so this can't re-fire into a loop.
              try {
                if (cbs.render(b)) {
                  self.markCanvasDrawn()
                }
              } catch (e) {
                self.setRenderError(e)
              }
            },
            { name: 'RenderLifecycle:render' },
          ),
        )
      },
    }))
}
