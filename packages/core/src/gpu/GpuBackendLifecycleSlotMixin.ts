import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

export interface InstallGpuDisplayCallbacks<B> {
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
 * `self.installGpuDisplay(backend, { upload, render })` from their own
 * `startGpuBackendLifecycle(backend)` action. The mixin owns:
 *
 *  - `canvasDrawn` — observable flag read by overlays / loading UI.
 *  - `currentGpuBackend` — the backend reference, updated on context-loss
 *    recovery. Autoruns read it each tick so they re-fire against the new
 *    one without being reinstalled.
 *  - `renderBump` — counter the render autorun observes; bumped by
 *    `renderNow()` (tab-visibility restore) and after every upload
 *    (ensures render re-fires when an upload happens but renderState
 *    identity stays stable).
 *  - `gpuAutorunsInstalled` — guards `installGpuDisplay` so the autorun
 *    pair is spawned once per model instance, not once per backend
 *    assignment.
 *
 * The `upload` callback runs in one autorun, `render` in another. Inside
 * each, every observable read is auto-tracked by MobX — no getter-layer
 * indirection, no multi-entry config. `render` returns `true` when the
 * backend actually painted content (flips `canvasDrawn`), `false` to skip
 * this tick (e.g. `renderState` not yet computed or no regions loaded).
 */
export function GpuBackendLifecycleSlotMixin() {
  return types
    .model('GpuBackendLifecycleSlot', {})
    .volatile(() => ({
      canvasDrawn: false,
      currentGpuBackend: undefined as unknown,
      renderBump: 0,
      gpuAutorunsInstalled: false,
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
      stopGpuBackendLifecycle() {
        self.currentGpuBackend = undefined
      },
      renderNow() {
        self.renderBump += 1
      },
    }))
    .actions(self => ({
      installGpuDisplay<B>(backend: B, cbs: InstallGpuDisplayCallbacks<B>) {
        self.currentGpuBackend = backend
        if (self.gpuAutorunsInstalled) {
          return
        }
        self.gpuAutorunsInstalled = true
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentGpuBackend as B | undefined
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
            { name: 'GpuBackendLifecycleSlot:upload' },
          ),
        )
        addDisposer(
          self,
          autorun(
            () => {
              const b = self.currentGpuBackend as B | undefined
              void self.renderBump
              if (b === undefined) {
                return
              }
              if (cbs.render(b)) {
                self.markCanvasDrawn()
              }
            },
            { name: 'GpuBackendLifecycleSlot:render' },
          ),
        )
      },
    }))
}
