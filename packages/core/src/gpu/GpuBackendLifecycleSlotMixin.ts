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
 * underlying utility, auto-wires `markCanvasDrawn` onto the commit hook
 * (unless the plugin supplies its own `onAfterCommit`), and assigns the
 * returned handle into the slot. The hand-off is complete in one call —
 * nothing else leaks into the plugin.
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
      startMultiRegionGpuLifecycle<
        BackendType,
        RegionDataType,
        RenderStateType,
      >(
        args: StartGpuBackendAutorunLifecycleArgs<
          BackendType,
          RegionDataType,
          RenderStateType
        >,
      ) {
        const userOnAfterCommit = args.onAfterCommit
        self.assignGpuBackendLifecycleHandle(
          startGpuBackendAutorunLifecycle<
            BackendType,
            RegionDataType,
            RenderStateType
          >({
            ...args,
            onAfterCommit:
              userOnAfterCommit ||
              (hadData => {
                if (hadData) {
                  self.markCanvasDrawn()
                }
              }),
          }),
        )
      },
      startSingleDataGpuLifecycle<BackendType, RenderStateType>(
        args: StartGpuSingleDataBackendAutorunLifecycleArgs<
          BackendType,
          RenderStateType
        >,
      ) {
        const userOnAfterCommit = args.onAfterCommit
        self.assignGpuBackendLifecycleHandle(
          startGpuSingleDataBackendAutorunLifecycle<BackendType, RenderStateType>({
            ...args,
            onAfterCommit:
              userOnAfterCommit ||
              (ready => {
                if (ready) {
                  self.markCanvasDrawn()
                }
              }),
          }),
        )
      },
    }))
}
