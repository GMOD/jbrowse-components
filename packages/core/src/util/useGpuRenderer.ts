import { useCallback, useEffect, useRef, useState } from 'react'

import { onDeviceLost } from '../gpu/getGpuDevice.ts'

interface UseGpuRendererOptions<R> {
  onReady?: (renderer: R) => void
  onDispose?: () => void
}

/**
 * Shared hook for GPU renderer initialization, error handling, context loss
 * recovery, and retry. Used by wiggle, variant, hic, synteny, and alignments
 * display components.
 *
 * The returned `canvasRef` is a callback ref — assign it directly to a
 * `<canvas ref={canvasRef} />`. React invokes it with the DOM node on mount
 * and with `null` on unmount, so the initialization effect re-runs when the
 * underlying canvas element is actually replaced (e.g. after regionTooLarge
 * unmounts then remounts the canvas).
 *
 * Pattern:
 *   1. Canvas mounts → init effect calls factory(canvas)
 *   2. WebGL context loss or WebGPU device loss → contextVersion bumps →
 *      cleanup disposes old backend → effect re-runs creating a fresh backend
 *   3. Error → ErrorBar with retry → retry() clears state + bumps
 *      contextVersion so the next render reinitializes
 *
 * For displays with model-driven autoruns, pass onReady/onDispose callbacks to
 * stash the backend in an MST volatile so autoruns can observe it.
 */
export function useGpuRenderer<R extends { dispose(): void }>(
  factory: (canvas: HTMLCanvasElement) => Promise<R>,
  opts?: UseGpuRendererOptions<R>,
) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const [contextVersion, setContextVersion] = useState(0)
  const rendererRef = useRef<R | null>(null)

  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    setCanvas(node)
  }, [])

  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    // preventDefault on contextlost allows the context to be restored.
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
  }, [canvas])

  useEffect(
    () =>
      onDeviceLost(() => {
        setContextVersion(v => v + 1)
      }),
    [],
  )

  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    let cancelled = false
    let backend: R | null = null
    factory(canvas)
      .then(r => {
        if (cancelled) {
          r.dispose()
          return
        }
        backend = r
        rendererRef.current = r
        setReady(true)
        opts?.onReady?.(r)
      })
      .catch((e: unknown) => {
        console.error('[useGpuRenderer] factory rejected:', e)
        if (!cancelled) {
          setError(e)
        }
      })

    // When the browser performs a hard navigation (e.g. page.goto() in
    // Puppeteer tests, or the user navigating away), the JS context is
    // destroyed without running React cleanup effects. This means the
    // useEffect return function (which calls renderer.dispose()) never
    // fires, and WebGL contexts + all their GPU buffers leak until GC
    // eventually reclaims them. Chrome caps active WebGL contexts at ~16
    // and its GPU process can OOM well before GC runs.
    //
    // The pagehide event fires synchronously during navigation, giving us
    // a reliable hook to release GPU resources before the page dies.
    const handlePageHide = () => {
      if (!cancelled) {
        cancelled = true
        backend?.dispose()
      }
    }
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      cancelled = true
      backend?.dispose()
      rendererRef.current = null
      setReady(false)
      opts?.onDispose?.()
    }
    // opts is intentionally omitted — callers must pass a stable identity
    // (via useMemo) or accept that re-renders reinitialize the backend
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, contextVersion, factory])

  function retry() {
    setError(null)
    setReady(false)
    setContextVersion(v => v + 1)
  }

  return { canvasRef, error, ready, rendererRef, retry }
}
