/* eslint-disable react-compiler/react-compiler */
import { useEffect, useRef, useState } from 'react'

import { setupWebGLContextLossHandler } from './webglContextLoss.ts'

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
 * 2. WebGL context loss → contextVersion bumps → cleanup disposes old
 *    backend → effect re-runs creating fresh backend
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  }, [canvasRef])

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
    return () => {
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
