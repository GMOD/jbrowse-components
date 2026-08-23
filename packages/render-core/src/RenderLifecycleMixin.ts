import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The slice of a display an installer needs. Every display that paints composes
 * {@link RenderLifecycleMixin} (directly or through `MultiRegionDisplayMixin` /
 * `GlobalDataDisplayMixin`), so this is satisfied by construction; it exists so
 * the installers can take `self` without importing a plugin's model type.
 */
export interface LifecycleHost extends IStateTreeNode {
  attachRenderingBackend: <B>(
    b: B,
    setup: () => RenderingBackendCallbacks<B>,
  ) => void
}

export interface RenderingBackendCallbacks<B> {
  /**
   * Push bytes for the current data and say whether anything reached the
   * backend. `true` forces a redraw, which a first arrival needs when the
   * render callback's own dependencies are identity-stable across it; the
   * map-diffing installers answer `false` for a run that uploaded nothing.
   */
  upload: (backend: B) => boolean
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
 * `self.attachRenderingBackend(backend, () => ({ upload, render }))` from their
 * own `startRenderingBackend(backend)` action. **The second argument is a thunk
 * because it runs exactly once**, on the first attach: `startRenderingBackend`
 * fires again on every context-loss recovery, and the autoruns keep the
 * callbacks they were given first. Anything the callbacks close over — an
 * upload sync's memo of what it last sent — is built inside it, so it lives as
 * long as the callbacks that read it rather than being allocated per recovery
 * and discarded. The mixin owns:
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

      /**
       * #getter
       * Overridable hook (default false): the display has reached a state it
       * will not paint its way out of, so `painted` below should answer
       * *finished* rather than *pending*. Both LGV fetch families fill it with
       * `!!error` — a fetch that failed before first paint keeps its canvas
       * mounted, since the error bar is an overlay rather than a subtree
       * replacement, so nothing ever draws into it. Named for `fetchInert` on
       * the comparative side.
       *
       * A hook rather than a read of `error` here, for two reasons that both
       * bite: this package is a leaf and `error` belongs to the fetch mixins,
       * and declaring that name here would *collide* with `FetchMixin`'s
       * volatile — `types.compose` gives the collision to its later argument,
       * and the two families compose the two mixins in opposite orders.
       */
      get paintInert(): boolean {
        return false
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
       * `fetchInert`) and the SVG export (`fetchInert`) —
       * while the fourth, `data-display-drawn`, went on publishing `"false"`
       * forever off the raw flag. That attribute is what `PENDING_DISPLAYS`
       * (`@jbrowse/browser-test-utils`) selects on, so a zoomed-out reference
       * sequence track made every `waitForDisplaysDone` on the page burn its
       * full timeout — silently, since that wait swallows its own. Same shape
       * as `fetchInert` on the comparative side: the reader you forget is the
       * one outside the display, so the display has to publish one name for it.
       *
       * `paintInert` is the third term and the same argument once more, for the
       * state where a display *would* paint a canvas and never gets to — a fetch
       * that failed before first paint. See that hook.
       */
      get painted(): boolean {
        return self.canvasDrawn || !self.rendersCanvas || self.paintInert
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
       * pair. Idempotent: re-calling swaps the backend and does not run `setup`
       * again, so the callbacks and everything they close over are the first
       * call's.
       */
      attachRenderingBackend<B>(
        backend: B,
        setup: () => RenderingBackendCallbacks<B>,
      ) {
        self.currentRenderingBackend = backend
        if (self.autorunsInstalled) {
          return
        }
        // Before the flag, so a throw in `setup` leaves the display
        // un-installed and the next backend can try again.
        const cbs = setup()
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
              // strand the display on 'loading' forever with no retry. For
              // DisplayChrome consumers setting `renderError` unmounts the
              // canvas and disposes the backend, so this can't re-fire into a
              // loop; a shared-canvas consumer (dotplot, synteny) keeps the
              // canvas mounted through an error (ADR-025), so there the only
              // pacing is that autoruns re-fire on dep changes — a
              // deterministically-throwing callback re-throws once per change,
              // each landing on `setRenderError`'s identity guard.
              try {
                if (cbs.upload(b)) {
                  self.renderNow()
                }
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
              // Same loop caveat as the upload autorun above: the
              // unmount-and-dispose that prevents re-fire is DisplayChrome's,
              // not a shared canvas's.
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
