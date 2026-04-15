import { types } from '@jbrowse/mobx-state-tree'

import type { GpuBackendAutorunLifecycleHandle } from './startGpuBackendAutorunLifecycle.ts'
import type { GpuSingleDataBackendAutorunLifecycleHandle } from './startGpuSingleDataBackendAutorunLifecycle.ts'

/**
 * Small MST mixin that every GPU display composes to own the lifecycle handle
 * produced by `startGpuBackendAutorunLifecycle` or
 * `startGpuSingleDataBackendAutorunLifecycle`.
 *
 * Provides:
 *   - volatile `gpuBackendLifecycleHandle` slot,
 *   - `stopGpuBackendLifecycle()` action (dispose + clear),
 *   - `renderNow()` action (imperative re-render escape hatch),
 *   - `assignGpuBackendLifecycleHandle(handle)` action — the plugin's own
 *     `startGpuBackendLifecycle(backend)` calls this with the result of
 *     `startGpu…AutorunLifecycle({ ... })`.
 *
 * Plugins only need to define `startGpuBackendLifecycle(backend)` — the rest
 * is inherited. This keeps the three cross-plugin concerns (slot shape,
 * disposal contract, renderNow semantics) unified so they can't drift.
 */
export function GpuBackendLifecycleSlotMixin() {
  return types
    .model('GpuBackendLifecycleSlot', {})
    .volatile(() => ({
      gpuBackendLifecycleHandle: undefined as
        | GpuBackendAutorunLifecycleHandle
        | GpuSingleDataBackendAutorunLifecycleHandle
        | undefined,
    }))
    .actions(self => ({
      assignGpuBackendLifecycleHandle(
        handle:
          | GpuBackendAutorunLifecycleHandle
          | GpuSingleDataBackendAutorunLifecycleHandle,
      ) {
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
}
