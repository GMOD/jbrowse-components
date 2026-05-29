import { useMemo } from 'react'

import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { useRenderer } from './useRenderer.ts'
import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'

function nodeAlive(model: unknown) {
  if (isStateTreeNode(model)) {
    return isAlive(model)
  }
  return true
}

/**
 * Duck-typed shape of an MST display model that owns a GPU backend
 * lifecycle via `RenderLifecycleMixin`. Plugins pass their own
 * model; the hook only touches these three actions.
 */
export interface RenderLifecycleModel<RenderingBackendType> {
  startRenderingBackend: (backend: RenderingBackendType) => void
  stopRenderingBackend: () => void
  renderNow: () => void
}

/**
 * One-call replacement for the boilerplate every GPU display component
 * used to repeat:
 *
 *     const { canvasRef, error, retry } = useRenderer(Factory, {
 *       onReady: backend => model.startRenderingBackend(backend),
 *       onDispose: () => model.stopRenderingBackend(),
 *     })
 *     useTabVisibilityRerender(() => model.renderNow())
 *
 * The model argument is duck-typed to the slot mixin's contract — the
 * three actions are all the hook touches.
 */
export function useRenderingBackend<RenderingBackendType extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<RenderingBackendType>,
  model: RenderLifecycleModel<RenderingBackendType>,
) {
  const opts = useMemo(
    () => ({
      onReady: (backend: RenderingBackendType) => {
        if (nodeAlive(model)) {
          model.startRenderingBackend(backend)
        }
      },
      onDispose: () => {
        if (nodeAlive(model)) {
          model.stopRenderingBackend()
        }
      },
    }),
    [model],
  )
  const { canvas, canvasRef, error, retry } = useRenderer(factory, opts)
  useTabVisibilityRerender(() => {
    if (nodeAlive(model)) {
      model.renderNow()
    }
  })
  return { canvas, canvasRef, error, retry }
}
