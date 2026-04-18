import { useMemo } from 'react'

import { useGpuRenderer } from './useGpuRenderer.ts'
import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'

/**
 * Duck-typed shape of an MST display model that owns a GPU backend
 * lifecycle via `GpuBackendLifecycleSlotMixin`. Plugins pass their own
 * model; the hook only touches these three actions.
 */
export interface GpuLifecycleModel<BackendType> {
  startGpuBackendLifecycle: (backend: BackendType) => void
  stopGpuBackendLifecycle: () => void
  renderNow: () => void
}

/**
 * One-call replacement for the boilerplate every GPU display component
 * used to repeat:
 *
 *     const { canvasRef, error, retry } = useGpuRenderer(Factory, {
 *       onReady: backend => model.startGpuBackendLifecycle(backend),
 *       onDispose: () => model.stopGpuBackendLifecycle(),
 *     })
 *     useTabVisibilityRerender(() => model.renderNow())
 *
 * The model argument is duck-typed to the slot mixin's contract — the
 * three actions are all the hook touches.
 */
export function useGpuModelLifecycle<BackendType extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<BackendType>,
  model: GpuLifecycleModel<BackendType>,
) {
  const opts = useMemo(
    () => ({
      onReady: (backend: BackendType) => {
        model.startGpuBackendLifecycle(backend)
      },
      onDispose: () => {
        model.stopGpuBackendLifecycle()
      },
    }),
    [model],
  )
  const { canvas, canvasRef, error, retry } = useGpuRenderer(factory, opts)
  useTabVisibilityRerender(() => {
    model.renderNow()
  })
  return { canvas, canvasRef, error, retry }
}
