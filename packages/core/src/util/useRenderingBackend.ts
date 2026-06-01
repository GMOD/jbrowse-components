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
  renderError: unknown
  setRenderError: (error: unknown) => void
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
export function useRenderingBackend<
  RenderingBackendType extends { dispose(): void },
>(
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
      onError: (error: unknown) => {
        if (nodeAlive(model)) {
          model.setRenderError(error)
        }
      },
    }),
    [model],
  )
  const { canvas, canvasRef, retry } = useRenderer(factory, opts)
  useTabVisibilityRerender(() => {
    if (nodeAlive(model)) {
      model.renderNow()
    }
  })
  // `error` is sourced from model volatile, not React-local hook state: the
  // model owns the terminal state, the hook only writes/reads it. Returned for
  // standalone consumers (dotplot, synteny) that render their own banner;
  // DisplayChrome reads `model.renderError` directly.
  return { canvas, canvasRef, error: model.renderError, retry }
}
