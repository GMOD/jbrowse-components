import { useCallback, useEffect, useRef, useState } from 'react'

import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'
import { onDeviceLost } from '../gpu/gpuDevice.ts'

function nodeAlive(model: unknown) {
  if (isStateTreeNode(model)) {
    return isAlive(model)
  }
  return true
}

/**
 * Duck-typed shape of an MST display model that owns a GPU backend
 * lifecycle via `RenderLifecycleMixin`. Plugins pass their own
 * model; the hook only touches these actions/fields.
 */
export interface RenderLifecycleModel<RenderingBackendType> {
  startRenderingBackend: (backend: RenderingBackendType) => void
  stopRenderingBackend: () => void
  renderNow: () => void
  renderError: unknown
  setRenderError: (error: unknown) => void
}

/**
 * Drives the GPU/Canvas2D backend lifecycle for a display: canvas
 * initialization, context-loss / device-loss recovery, page-navigation
 * cleanup, and retry — wiring each event directly to the model's
 * `RenderLifecycleMixin` actions so the model (not React-local hook state)
 * owns every terminal state.
 *
 * The returned `canvasRef` is a callback ref — assign it directly to a
 * `<canvas ref={canvasRef} />`. React invokes it with the DOM node on mount
 * and with `null` on unmount, so the initialization effect re-runs when the
 * underlying canvas element is actually replaced (e.g. after regionTooLarge
 * unmounts then remounts the canvas).
 *
 * Lifecycle:
 *   1. Canvas mounts → init effect calls `factory(canvas)`; on success
 *      `setRenderError(undefined)` + `startRenderingBackend(backend)`, on
 *      failure `setRenderError(error)`.
 *   2. WebGL context loss or WebGPU device loss → `contextVersion` bumps →
 *      cleanup disposes the old backend (`stopRenderingBackend`) → effect
 *      re-runs creating a fresh backend.
 *   3. `retry()` clears `renderError` + bumps `contextVersion` so the next
 *      mount reinitializes.
 *
 * Page navigation fires `pagehide` on every mounted component, disposing its
 * backend; React unmount disposes via the effect cleanup. No global tracking.
 *
 * The model argument is duck-typed to the slot mixin's contract — the listed
 * actions/fields are all the hook touches.
 */
export function useRenderingBackend<
  RenderingBackendType extends { dispose(): void },
>(
  factory: (canvas: HTMLCanvasElement) => Promise<RenderingBackendType>,
  model: RenderLifecycleModel<RenderingBackendType>,
) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [contextVersion, setContextVersion] = useState(0)
  const rendererRef = useRef<RenderingBackendType | null>(null)

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvas(node)
  }, [])

  useEffect(() => {
    if (canvas) {
      const onLost = (e: Event) => {
        e.preventDefault()
      }
      const onRestored = () => {
        setContextVersion(v => v + 1)
      }
      canvas.addEventListener('webglcontextlost', onLost)
      canvas.addEventListener('webglcontextrestored', onRestored)
      return () => {
        canvas.removeEventListener('webglcontextlost', onLost)
        canvas.removeEventListener('webglcontextrestored', onRestored)
      }
    }
    return undefined
  }, [canvas])

  useEffect(
    () =>
      onDeviceLost(() => {
        setContextVersion(v => v + 1)
      }),
    [],
  )

  useEffect(() => {
    const handleGlobalPageHide = () => {
      rendererRef.current?.dispose()
    }
    window.addEventListener('pagehide', handleGlobalPageHide, true)
    return () => {
      window.removeEventListener('pagehide', handleGlobalPageHide, true)
    }
  }, [])

  useEffect(() => {
    if (canvas) {
      let cancelled = false
      let backend: RenderingBackendType | null = null
      factory(canvas)
        .then(r => {
          if (cancelled) {
            r.dispose()
          } else {
            backend = r
            rendererRef.current = r
            if (nodeAlive(model)) {
              model.setRenderError(undefined)
              model.startRenderingBackend(r)
            }
          }
        })
        .catch((e: unknown) => {
          if (!cancelled && nodeAlive(model)) {
            model.setRenderError(e)
          }
        })

      return () => {
        cancelled = true
        backend?.dispose()
        rendererRef.current = null
        if (nodeAlive(model)) {
          model.stopRenderingBackend()
        }
      }
    }
    return undefined
  }, [canvas, contextVersion, factory, model])

  useTabVisibilityRerender(() => {
    if (nodeAlive(model)) {
      model.renderNow()
    }
  })

  function retry() {
    if (nodeAlive(model)) {
      model.setRenderError(undefined)
    }
    setContextVersion(v => v + 1)
  }

  // `error` is sourced from model volatile, not React-local hook state: the
  // model owns the terminal state, the hook only writes/reads it. Returned for
  // standalone consumers (dotplot, synteny) that render their own banner;
  // DisplayChrome reads `model.renderError` directly.
  return { canvas, canvasRef, error: model.renderError, retry }
}
