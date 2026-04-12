/* eslint-disable react-compiler/react-compiler */
import { useEffect, useRef, useState } from 'react'

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
 * Pattern:
 * 1. Canvas mounts → useEffect calls factory(canvas) to create and init backend
 * 2. WebGL context loss or WebGPU device loss → contextVersion bumps →
 *    cleanup disposes old backend → effect re-runs creating fresh backend
 * 3. Error → ErrorBar with retry → retry resets state + bumps contextVersion
 *
 * For displays with model-driven autoruns (alignments, synteny), pass
 * onReady/onDispose callbacks to store the backend in the MST model
 * volatile so autoruns can track it as a MobX observable.
 */
export function useGpuRenderer<R extends { dispose(): void }>(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  factory: (canvas: HTMLCanvasElement) => Promise<R>,
  opts?: UseGpuRendererOptions<R>,
) {
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const [contextVersion, setContextVersion] = useState(0)
  const rendererRef = useRef<R | null>(null)
  const lastCanvasRef = useRef<HTMLCanvasElement | null>(null)
  // No deps: runs every render to detect when canvasRef.current is a new
  // element (e.g. after regionTooLarge unmounts and remounts the canvas).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && lastCanvasRef.current && lastCanvasRef.current !== canvas) {
      setContextVersion(v => v + 1)
    }
    if (canvas) {
      lastCanvasRef.current = canvas
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
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
  }, [canvasRef])

  useEffect(() => {
    return onDeviceLost(() => {
      setContextVersion(v => v + 1)
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
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
        if (!cancelled) {
          setError(e)
        }
      })

    // When the browser performs a hard navigation (e.g. page.goto() in
    // Puppeteer tests, or the user navigating away), the JS context is
    // destroyed without running React cleanup effects.  This means the
    // useEffect return function (which calls renderer.dispose()) never
    // fires, and WebGL contexts + all their GPU buffers leak until GC
    // eventually reclaims them.  Chrome caps active WebGL contexts at
    // ~16 and its GPU process can OOM well before GC runs.
    //
    // The pagehide event fires synchronously during navigation, giving
    // us a reliable hook to release GPU resources before the page dies.
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
    // opts callbacks (onReady/onDispose) are intentionally omitted from deps —
    // callers must pass stable references (e.g. useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextVersion, factory, canvasRef])

  function retry() {
    setError(null)
    setReady(false)
    setContextVersion(v => v + 1)
  }

  return { error, ready, rendererRef, retry }
}
