import { useCallback, useEffect, useRef, useState } from 'react'

import { onDeviceLost } from '../gpu/gpuDevice.ts'

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
 *
 * Cleanup paths: React unmount disposes via the effect cleanup;
 * page navigation fires `pagehide` on every mounted component, which
 * disposes that component's backend. No global tracking needed.
 */
export function useRenderer<R extends { dispose(): void }>(
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
    const handleGlobalPageHide = () => {
      rendererRef.current?.dispose()
    }
    window.addEventListener('pagehide', handleGlobalPageHide, true)
    return () => {
      window.removeEventListener('pagehide', handleGlobalPageHide, true)
    }
  }, [])

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
        if (!cancelled) {
          setError(e)
        }
      })

    return () => {
      cancelled = true
      backend?.dispose()
      rendererRef.current = null
      setReady(false)
      opts?.onDispose?.()
    }
  }, [canvas, contextVersion, factory, opts])

  function retry() {
    setError(null)
    setReady(false)
    setContextVersion(v => v + 1)
  }

  return { canvas, canvasRef, error, ready, rendererRef, retry }
}
