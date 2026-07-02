import { useCallback, useEffect, useRef, useState } from 'react'

import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { onDeviceLost } from './gpuDevice.ts'
import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'

// Auto-recovery from WebGL context loss. The browser force-loses the oldest
// context when too many are live (and may never fire `webglcontextrestored`),
// which strands the display on the GPU error overlay. We re-init a FEW times on
// an exponential backoff so it comes back once GPU capacity frees — then stop
// and leave the manual Retry button, deliberately leaning on manual recovery
// rather than risk thrashing the page with endless re-inits. The attempt budget
// resets ONLY on a genuine browser restore or a manual retry (never on a bare
// re-acquire), so a context that keeps flapping climbs to the cap and stops —
// it can never spin in an infinite loop.
const MAX_CONTEXT_RECOVER_ATTEMPTS = 2
const CONTEXT_RECOVER_BASE_MS = 1000

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
  RenderingBackendType extends {
    dispose(): void
    // Optional: the shared GPU/Canvas2D backend bases provide it (forwarding to
    // the HAL's OOM reporter), but standalone backends (dotplot, synteny) that
    // implement their interface directly need not — they simply forgo OOM->
    // renderError routing until they opt in.
    setErrorHandler?: (handler: (error: Error) => void) => void
  },
>(
  factory: (canvas: HTMLCanvasElement) => Promise<RenderingBackendType>,
  model: RenderLifecycleModel<RenderingBackendType>,
) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [contextVersion, setContextVersion] = useState(0)
  const rendererRef = useRef<RenderingBackendType | null>(null)

  // Set true the moment a `webglcontextlost` fires; gates auto-recovery so only
  // a genuine context loss triggers it (not a config/render-logic error). The
  // canvas often unmounts behind the error overlay before recovery runs, so
  // recovery is driven by `renderError` (always observed) + this sticky flag,
  // not by the canvas-bound listener.
  const contextLostRef = useRef(false)
  const recoverAttemptsRef = useRef(0)
  const recoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvas(node)
  }, [])

  useEffect(() => {
    if (canvas) {
      const onLost = (e: Event) => {
        e.preventDefault()
        contextLostRef.current = true
      }
      const onRestored = () => {
        // browser recovered on its own: cancel any pending backoff + reset
        clearTimeout(recoverTimerRef.current)
        recoverTimerRef.current = undefined
        contextLostRef.current = false
        recoverAttemptsRef.current = 0
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

  // Auto-recover a context-loss-induced error: re-init on bounded backoff. Gated
  // on `contextLostRef` so non-GPU render errors are never auto-retried, and on
  // a one-pending-timer guard so it schedules at most one attempt at a time. The
  // attempt counter is reset only on a clean init / restore / manual retry, so a
  // context that keeps re-losing climbs to the cap then stops — never spins.
  // Runs every render (no dep array) on purpose: the guards make it idempotent,
  // and depending on `model.renderError` is unreliable here (a plain re-render
  // can miss the value transition). The unmount cleanup is the separate effect
  // below.
  useEffect(() => {
    if (
      model.renderError &&
      contextLostRef.current &&
      recoverTimerRef.current === undefined &&
      recoverAttemptsRef.current < MAX_CONTEXT_RECOVER_ATTEMPTS
    ) {
      const delay = CONTEXT_RECOVER_BASE_MS * 2 ** recoverAttemptsRef.current
      recoverAttemptsRef.current += 1
      recoverTimerRef.current = setTimeout(() => {
        recoverTimerRef.current = undefined
        if (nodeAlive(model)) {
          model.setRenderError(undefined)
        }
        setContextVersion(v => v + 1)
      }, delay)
    }
  })

  // Clear any pending auto-recovery timer on unmount.
  useEffect(
    () => () => {
      clearTimeout(recoverTimerRef.current)
    },
    [],
  )

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
            // Route HAL out-of-memory / over-device-limit allocation failures to
            // renderError so an over-large view shows an error overlay (with a
            // manual Retry) instead of a silently-blank canvas. Not gated on
            // contextLostRef, so it never auto-retries — an OOM recurs on retry.
            r.setErrorHandler?.(e => {
              if (nodeAlive(model)) {
                model.setRenderError(e)
              }
            })
            // init produced a backend: clear the context-loss scoping flag so a
            // later non-GPU error isn't mistaken for a context loss. The attempt
            // counter is deliberately NOT reset here — a context that resolves
            // then immediately re-loses must keep climbing toward the cap rather
            // than spin forever; only a real restore / manual retry resets it.
            contextLostRef.current = false
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
    // manual retry = fresh start: cancel pending backoff and reset the budget
    clearTimeout(recoverTimerRef.current)
    recoverTimerRef.current = undefined
    contextLostRef.current = false
    recoverAttemptsRef.current = 0
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
