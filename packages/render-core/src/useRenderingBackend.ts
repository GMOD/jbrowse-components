import { useCallback, useEffect, useRef, useState } from 'react'

import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { onDeviceLost } from './gpuDevice.ts'
import { RecoveryBudget } from './recoveryBudget.ts'
import { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'

import type { RefObject } from 'react'

// Auto-recovery from WebGL context loss. The browser force-loses the oldest
// context when too many are live (and may never fire `webglcontextrestored`),
// which strands the display on the GPU error overlay. We re-init a FEW times on
// an exponential backoff so it comes back once GPU capacity frees — then stop
// and leave the manual Retry button, deliberately leaning on manual recovery
// rather than risk thrashing the page with endless re-inits. The budget is
// `RecoveryBudget`, which is windowed: a context that keeps flapping climbs to
// the cap and stops, but two losses far enough apart to not be a flap each get
// their own recovery. It resets outright only on a genuine browser restore or a
// manual retry (never on a bare re-acquire — every flap contains one).
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

const DEVICE_LOST_MESSAGE =
  'WebGPU device lost. The GPU device backing this display went away and kept ' +
  'going away after several attempts to rebuild on a fresh one.'

/**
 * Flagged rather than matched by message or `instanceof`, so the error UI can
 * offer the remedy specific to a loss (switch the page to Canvas2D) without
 * offering it for render errors whose remedy differs (an over-allocation says to
 * zoom in).
 *
 * A lost WebGPU device carries the same flag deliberately: the two causes
 * differ, but the remedy on offer — take the page off the GPU — is the same one.
 */
export function createGpuContextLostError(message = CONTEXT_LOST_MESSAGE) {
  return Object.assign(new Error(message), {
    gpuContextLost: true as const,
  })
}

export function createGpuDeviceLostError() {
  return createGpuContextLostError(DEVICE_LOST_MESSAGE)
}

export function isGpuContextLostError(error: unknown) {
  return (
    typeof error === 'object' && error !== null && 'gpuContextLost' in error
  )
}

/**
 * The display's recovery budget, created on first read. Reached through the ref
 * at every use site rather than unwrapped once in the hook body: the unwrapped
 * value is a fresh binding each render, so an effect closing over it has to
 * name it as a dependency, and then the effect re-subscribes on every render.
 * The ref itself is stable and needs no dependency.
 */
function budgetOf(ref: RefObject<RecoveryBudget | null>) {
  return (ref.current ??= new RecoveryBudget())
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
 *
 * **`factory` must be referentially stable** — a module-level constant, as every
 * consumer in this repo passes (`AlignmentsRenderer`, `createDotplotRenderer`,
 * …). It is a dependency of the init effect, so an inline
 * `canvas => new MyBackend(canvas)` rebuilds the backend on every render:
 * dispose, async re-create, `startRenderingBackend`, forever. Nothing throws and
 * nothing logs — the display just paints from a backend a render behind, and the
 * GPU churn shows up only in a profile. Bind the factory outside the component
 * (or `useCallback` it with no deps).
 */
export function useRenderingBackend<
  RenderingBackendType extends {
    dispose(): void
    // Required, and the requirement is the point: the GPU base forwards to the
    // HAL's OOM reporter and the Canvas2D base no-ops, so a backend gets this
    // by extending one of them. It was optional while dotplot and synteny
    // implemented their interfaces standalone — and those two, the ones that
    // allocate the largest buffers in the app, were exactly the ones whose
    // over-limit allocations reached no one. `?.` here reads as tolerance and
    // spends as silence.
    setErrorHandler: (handler: (error: Error) => void) => void
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
  // One budget across both loss families, not one each: a display renders on a
  // single HAL rung at a time, and sharing it stops a display that flaps
  // between the two from spending a fresh allowance on each.
  const budgetRef = useRef<RecoveryBudget | null>(null)
  // Latched once the budget says stop. The recovery effect below runs on every
  // render, so it needs a non-mutating way to know it has already given up —
  // asking the budget again would refresh its window and it would never lapse.
  const gaveUpRef = useRef(false)
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
        gaveUpRef.current = false
        budgetOf(budgetRef).reset()
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
  // budget is spent only when an attempt is actually scheduled, so a context
  // that keeps re-losing climbs to the cap then stops — never spins.
  // Runs every render (no dep array) on purpose: the guards make it idempotent,
  // and depending on `model.renderError` is unreliable here (a plain re-render
  // can miss the value transition). The unmount cleanup is the separate effect
  // below.
  useEffect(() => {
    if (
      model.renderError &&
      contextLostRef.current &&
      !gaveUpRef.current &&
      recoverTimerRef.current === undefined
    ) {
      const budget = budgetOf(budgetRef)
      if (budget.record(performance.now()) === 'give-up') {
        gaveUpRef.current = true
        return
      }
      const delay = CONTEXT_RECOVER_BASE_MS * 2 ** (budget.attempt - 1)
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

  // WebGPU device loss. This re-inits invisibly — no grace window and no
  // `renderError`, because `gpuDevice` has already dropped the dead device and
  // the next `getGpuDevice()` acquires a fresh one — but it is bounded by the
  // same budget as the WebGL path, and for a sharper reason. A WebGL loss that
  // never recovers is at least *reported*: it sets `renderError`, which is what
  // unmounts the canvas. Nothing reports this one, so an uncapped version of it
  // is a display that re-initializes against a dying device forever, silently,
  // for as long as the tab is open. On give-up it says so instead.
  useEffect(
    () =>
      onDeviceLost(() => {
        if (gaveUpRef.current) {
          return
        }
        if (budgetOf(budgetRef).record(performance.now()) === 'give-up') {
          gaveUpRef.current = true
          if (nodeAlive(model)) {
            model.setRenderError(createGpuDeviceLostError())
          }
          return
        }
        setContextVersion(v => v + 1)
      }),
    [model],
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
            r.setErrorHandler(e => {
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
    gaveUpRef.current = false
    budgetOf(budgetRef).reset()
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
