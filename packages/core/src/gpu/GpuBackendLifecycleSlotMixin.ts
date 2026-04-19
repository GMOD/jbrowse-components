import { types } from '@jbrowse/mobx-state-tree'

import {
  type StartGpuBackendAutorunLifecycleArgs,
  startGpuBackendAutorunLifecycle,
} from './startGpuBackendAutorunLifecycle.ts'
import {
  type StartGpuSingleDataBackendAutorunLifecycleArgs,
  startGpuSingleDataBackendAutorunLifecycle,
} from './startGpuSingleDataBackendAutorunLifecycle.ts'

import type { GpuBackendLifecycleHandle } from './gpuBackendLifecycleHandle.ts'

/**
 * Owns the GPU draw lifecycle on any display that paints to a canvas. Three
 * things live here because they share one concern ("a backend is uploading
 * and rendering; when is its canvas considered drawn?"):
 *
 *  - `canvasDrawn` — observable flag read by overlays/loading UI,
 *  - `markCanvasDrawn()` — idempotent write (no observer churn once true),
 *  - `gpuBackendLifecycleHandle` — the autorun pair produced by either
 *    family utility (multi-region or single-data global).
 *
 * Plugins call `self.startMultiRegionGpuLifecycle({...})` or
 * `self.startSingleDataGpuLifecycle({...})` in their own
 * `startGpuBackendLifecycle(backend)` action. The wrapper starts the
 * underlying utility, wraps the plugin's `render` to fire
 * `markCanvasDrawn` after each draw call, and assigns the returned handle
 * into the slot. Because each util only calls `render` once data is
 * actually on the GPU (multi-region: ≥1 region uploaded; single-data:
 * every entry has data), `canvasDrawn` flips precisely when the canvas
 * holds real pixels — plugins gate visibility by returning `undefined`
 * from `renderState` (see wiggle's domain gate).
 */
export function GpuBackendLifecycleSlotMixin() {
  return types
    .model('GpuBackendLifecycleSlot', {})
    .volatile(() => ({
      canvasDrawn: false,
      gpuBackendLifecycleHandle: undefined as
        | GpuBackendLifecycleHandle
        | undefined,
    }))
    .actions(self => ({
      setCanvasDrawn(val: boolean) {
        if (self.canvasDrawn !== val) {
          self.canvasDrawn = val
        }
      },

      // Idempotent "first draw has happened" signal. Guards against the
      // per-commit observable write + dependent observer churn that a naive
      // setCanvasDrawn(true) call would produce once the canvas is drawn.
      markCanvasDrawn() {
        if (!self.canvasDrawn) {
          self.canvasDrawn = true
        }
      },

      assignGpuBackendLifecycleHandle(handle: GpuBackendLifecycleHandle) {
        self.gpuBackendLifecycleHandle?.dispose()
        self.gpuBackendLifecycleHandle = handle
      },
      stopGpuBackendLifecycle() {
        self.gpuBackendLifecycleHandle?.dispose()
        self.gpuBackendLifecycleHandle = undefined
      },
      renderNow() {
        self.gpuBackendLifecycleHandle?.renderNow()
      },
    }))
    .actions(self => ({
      startMultiRegionGpuLifecycle<BackendType, RenderStateType>(
        args: StartGpuBackendAutorunLifecycleArgs<BackendType, RenderStateType>,
      ) {
        const userRender = args.render
        self.assignGpuBackendLifecycleHandle(
          startGpuBackendAutorunLifecycle<BackendType, RenderStateType>({
            ...args,
            render: (b, blocks, state) => {
              userRender(b, blocks, state)
              self.markCanvasDrawn()
            },
          }),
        )
      },
      startSingleDataGpuLifecycle<BackendType, RenderStateType>(
        args: StartGpuSingleDataBackendAutorunLifecycleArgs<
          BackendType,
          RenderStateType
        >,
      ) {
        const userRender = args.render
        self.assignGpuBackendLifecycleHandle(
          startGpuSingleDataBackendAutorunLifecycle<
            BackendType,
            RenderStateType
          >({
            ...args,
            render: (b, state) => {
              userRender(b, state)
              self.markCanvasDrawn()
            },
          }),
        )
      },
    }))
}
