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
       * `loadingOverlayVisible` (suppresses the scrim) and by `DisplayChrome`
       * (shows the retry overlay).
       */
      renderError: undefined,
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
              if (b === undefined) {
                return
              }
              cbs.upload(b)
              // Force the render autorun to re-fire after each upload.
              // Needed when the render callback's observable dependencies
              // stay identity-stable across an upload (e.g. renderState
              // returning undefined before and after the first data
              // arrives because autoscale hasn't resolved). Without this,
              // first paint can be delayed until a user interaction
              // shifts a render dep.
              self.renderNow()
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
              if (b === undefined) {
                return
              }
              if (cbs.render(b)) {
                self.markCanvasDrawn()
              }
            },
            { name: 'RenderLifecycle:render' },
          ),
        )
      },
    }))
}
