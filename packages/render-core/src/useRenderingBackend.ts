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

// A lost context reports itself because nothing else will: calls on it are
// silent no-ops, and it can't be re-acquired on its element (see `canvasKey`
// below, which is what gets every consumer a fresh element).
//
// The report waits out a grace window first — a race against
// `webglcontextrestored`, which lands within a frame or two for the recoverable
// causes (GPU crash, driver reset) and needs no banner at all. Nothing is
// aborted when the window expires, so this is not a readiness cap.
const CONTEXT_LOST_REPORT_GRACE_MS = 400

const CONTEXT_LOST_MESSAGE =
  'WebGL context lost. The browser reclaimed the GPU context for this display, ' +
  'usually because too many GPU-rendered views are open at once.'

/**
 * Flagged rather than matched by message or `instanceof`, so the error UI can
 * offer the remedy specific to a loss (switch the page to Canvas2D) without
 * offering it for render errors whose remedy differs (an over-allocation says to
 * zoom in).
 */
export function createGpuContextLostError() {
  return Object.assign(new Error(CONTEXT_LOST_MESSAGE), {
    gpuContextLost: true as const,
  })
}

export function isGpuContextLostError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'gpuContextLost' in error
  )
}

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
 *   2. WebGL context loss → the browser gets one grace window to fire
 *      `webglcontextrestored` (which bumps `contextVersion` → rebuild, no user-
 *      visible state); if it doesn't, the loss is reported as `renderError`
 *      (`createGpuContextLostError`), which unmounts the canvas and so is what
 *      makes a fresh context obtainable at all. Bounded auto-recovery then
 *      clears it. WebGPU device loss bumps `contextVersion` directly.
 *   3. `retry()` clears `renderError` + bumps `contextVersion` so the next
 *      mount reinitializes.
 *
 * Page navigation fires `pagehide` on every mounted component, disposing its
 * backend AND clearing `model.currentRenderingBackend` (so the render/upload
 * autoruns no-op); React unmount disposes via the effect cleanup. A bfcache
 * restore fires `pageshow` with `persisted`, which rebuilds the backend for the
 * still-mounted canvas. No global tracking.
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
  // Pending "the browser didn't restore it" report; see
  // CONTEXT_LOST_REPORT_GRACE_MS. Separate from recoverTimerRef because the two
  // are different phases: this one sets renderError, that one clears it.
  const lossReportTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvas(node)
  }, [])

  useEffect(() => {
    if (canvas) {
      const onLost = (e: Event) => {
        // preventDefault is what permits `webglcontextrestored` at all; the timer
        // below is the wait for it
        e.preventDefault()
        contextLostRef.current = true
        clearTimeout(lossReportTimerRef.current)
        lossReportTimerRef.current = setTimeout(() => {
          lossReportTimerRef.current = undefined
          if (nodeAlive(model)) {
            model.setRenderError(createGpuContextLostError())
          }
        }, CONTEXT_LOST_REPORT_GRACE_MS)
      }
      const onRestored = () => {
        // browser recovered on its own: cancel pending timers, reset, rebuild
        // (every GL object from the old context is dead even though
        // `isContextLost()` now reads false)
        clearTimeout(lossReportTimerRef.current)
        lossReportTimerRef.current = undefined
        clearTimeout(recoverTimerRef.current)
        recoverTimerRef.current = undefined
        contextLostRef.current = false
        recoverAttemptsRef.current = 0
        setContextVersion(v => v + 1)
      }
      canvas.addEventListener('webglcontextlost', onLost)
      canvas.addEventListener('webglcontextrestored', onRestored)
      return () => {
        // Drop a report still in its grace window: nothing left to recover, and
        // `renderError` outranks every other phase, so a late one would replace a
        // legitimate too-large banner with a GPU error.
        clearTimeout(lossReportTimerRef.current)
        lossReportTimerRef.current = undefined
        canvas.removeEventListener('webglcontextlost', onLost)
        canvas.removeEventListener('webglcontextrestored', onRestored)
      }
    }
    return undefined
  }, [canvas, model])

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

  // Clear any pending loss-report / auto-recovery timer on unmount.
  useEffect(
    () => () => {
      clearTimeout(lossReportTimerRef.current)
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
      rendererRef.current = null
      // On a bfcache freeze this timer thaws AFTER pageshow rebuilt the backend,
      // bannering a working canvas.
      clearTimeout(lossReportTimerRef.current)
      lossReportTimerRef.current = undefined
      // Also clear the model's backend reference — not just dispose the GPU
      // object. On a bfcache navigate-away the component is frozen, not
      // unmounted, so the effect cleanup never runs; leaving
      // currentRenderingBackend pointing at the disposed backend would let the
      // upload/render autoruns fire against dead GPU state on restore. With it
      // cleared, those autoruns no-op (they guard `backend === undefined`) until
      // pageshow rebuilds a fresh one.
      if (nodeAlive(model)) {
        model.stopRenderingBackend()
      }
    }
    const handleGlobalPageShow = (e: PageTransitionEvent) => {
      // Restored from bfcache (persisted): the canvas DOM node survived but its
      // backend was disposed on pagehide. Bump contextVersion so the init effect
      // re-runs and builds a fresh backend for the same canvas.
      if (e.persisted) {
        setContextVersion(v => v + 1)
      }
    }
    window.addEventListener('pagehide', handleGlobalPageHide, true)
    window.addEventListener('pageshow', handleGlobalPageShow, true)
    return () => {
      window.removeEventListener('pagehide', handleGlobalPageHide, true)
      window.removeEventListener('pageshow', handleGlobalPageShow, true)
    }
  }, [model])

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
    // manual retry = fresh start: cancel pending timers and reset the budget
    clearTimeout(lossReportTimerRef.current)
    lossReportTimerRef.current = undefined
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
  //
  // `canvasKey` must reach the `<canvas key=…>` of EVERY consumer, not just the
  // standalone ones. A re-init needs an element that never held a context:
  // `getContext('webgl2')` keeps returning the lost one, `getContext('2d')`
  // returns null on any element that once had WebGL, and more generally a
  // canvas's context kind is permanent — so a re-init whose ladder lands on a
  // different rung than last time cannot bind at all.
  //
  // This used to say DisplayChrome consumers got it free, because `renderError`
  // unmounts the canvas. That covers only a *reported* loss: `onRestored`,
  // `onDeviceLost` and the bfcache `pageshow` above all bump `contextVersion`
  // and deliberately set no `renderError`, and those reused the element.
  // `DisplayChromeBase` now keys its render-prop body on this value, and the
  // standalone consumers get it from `RenderCanvas`.
  return {
    canvas,
    canvasRef,
    error: model.renderError,
    retry,
    canvasKey: contextVersion,
  }
}
