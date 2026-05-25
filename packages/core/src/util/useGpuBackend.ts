import { useMemo } from 'react'

import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { useGpuRenderer } from './useGpuRenderer.ts'
import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'

function nodeAlive(model: unknown) {
  if (isStateTreeNode(model)) {
    return isAlive(model)
  }
  return true
}

/**
 * Duck-typed shape of an MST display model that owns a GPU backend
 * lifecycle via `GpuLifecycleMixin`. Plugins pass their own
 * model; the hook only touches these three actions.
 */
export interface GpuLifecycleModel<BackendType> {
  startBackend: (backend: BackendType) => void
  stopBackend: () => void
  renderNow: () => void
}

/**
 * One-call replacement for the boilerplate every GPU display component
 * used to repeat:
 *
 *     const { canvasRef, error, retry } = useGpuRenderer(Factory, {
 *       onReady: backend => model.startBackend(backend),
 *       onDispose: () => model.stopBackend(),
 *     })
 *     useTabVisibilityRerender(() => model.renderNow())
 *
 * The model argument is duck-typed to the slot mixin's contract — the
 * three actions are all the hook touches.
 */
export function useGpuBackend<BackendType extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<BackendType>,
  model: GpuLifecycleModel<BackendType>,
) {
  const opts = useMemo(
    () => ({
      onReady: (backend: BackendType) => {
        if (nodeAlive(model)) {
          model.startBackend(backend)
        }
      },
      onDispose: () => {
        if (nodeAlive(model)) {
          model.stopBackend()
        }
      },
    }),
    [model],
  )
  const { canvas, canvasRef, error, retry } = useGpuRenderer(factory, opts)
  useTabVisibilityRerender(() => {
    if (nodeAlive(model)) {
      model.renderNow()
    }
  })
  return { canvas, canvasRef, error, retry }
}
