import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

export interface BackendCallbacks<B> {
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
 * `self.attachBackend(backend, { upload, render })` from their own
 * `startBackend(backend)` action. The mixin owns:
 *
 *  - `canvasDrawn` — observable flag read by test-selector `data-testid` attributes to detect first paint.
 *  - `currentBackend` — the backend reference, updated on context-loss
 *    recovery. Autoruns read it each tick so they re-fire against the new
 *    one without being reinstalled.
 *  - `renderTick` — counter the render autorun observes; bumped by
 *    `renderNow()` (tab-visibility restore) and after every upload
 *    (ensures render re-fires when an upload happens but renderState
 *    identity stays stable).
 *  - `autorunsInstalled` — guards `attachBackend` so the autorun
 *    pair is spawned once per model instance, not once per backend
 *    assignment.
 *
 * The `upload` callback runs in one autorun, `render` in another. Inside
 * each, every observable read is auto-tracked by MobX — no getter-layer
 * indirection, no multi-entry config. `render` returns `true` when the
 * backend actually painted content (flips `canvasDrawn`), `false` to skip
 * this tick (e.g. `renderState` not yet computed or no regions loaded).
 */
export function GpuLifecycleMixin() {
  return types
    .model('GpuLifecycle', {})
    .volatile(() => ({
      canvasDrawn: false,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      currentBackend: undefined as unknown,
      renderTick: 0,
      autorunsInstalled: false,
    }))
    .actions(self => ({
      markCanvasDrawn() {
        if (!self.canvasDrawn) {
          self.canvasDrawn = true
        }
      },
      resetCanvasDrawn() {
        if (self.canvasDrawn) {
          self.canvasDrawn = false
        }
      },
      stopBackend() {
        self.currentBackend = undefined
        self.canvasDrawn = false
      },
      renderNow() {
        self.renderTick += 1
      },
    }))
    .actions(self => ({
      // `cbs` is captured permanently by the autoruns on first call.
      // Re-calling with a new backend (context-loss recovery) updates
      // `currentBackend` only — `cbs` from the first call stay in effect.
      attachBackend<B>(backend: B, cbs: BackendCallbacks<B>) {
        self.currentBackend = backend
        if (self.autorunsInstalled) {
          return
        }
        self.autorunsInstalled = true
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentBackend as B | undefined
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
            { name: 'GpuLifecycle:upload' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentBackend as B | undefined
              void self.renderTick
              if (b === undefined) {
                return
              }
              if (cbs.render(b)) {
                self.markCanvasDrawn()
              }
            },
            { name: 'GpuLifecycle:render' },
          ),
        )
      },
    }))
}
