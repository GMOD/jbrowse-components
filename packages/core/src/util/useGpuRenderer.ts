/* eslint-disable react-compiler/react-compiler */
import { useEffect, useRef, useState } from 'react'

import { setupWebGLContextLossHandler } from './webglContextLoss.ts'

interface GpuRenderer {
  init(): Promise<boolean>
  dispose(): void
}

interface GpuRendererCache<R extends GpuRenderer> {
  getOrCreate(canvas: HTMLCanvasElement): R
}

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
 * 1. Canvas mounts → useEffect creates renderer via getOrCreate + init()
 * 2. WebGL context loss → contextVersion bumps → cleanup destroys old
 *    renderer → effect re-runs creating fresh renderer
 * 3. Error → ErrorBar with retry → retry resets state + bumps contextVersion
 *
 * For displays with model-driven autoruns (alignments, synteny), pass
 * onReady/onDispose callbacks to store the renderer in the MST model
 * volatile so autoruns can track it as a MobX observable.
 */
export function useGpuRenderer<R extends GpuRenderer>(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  rendererCache: GpuRendererCache<R>,
  opts?: UseGpuRendererOptions<R>,
) {
  const [error, setError] = useState<unknown>(null)
  const [ready, setReady] = useState(false)
  const [contextVersion, setContextVersion] = useState(0)
  const rendererRef = useRef<R | null>(null)
  const lastCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      // Detect when the canvas DOM element has been replaced (e.g. after
      // regionTooLarge unmounts and remounts the component tree). The ref
      // object identity is stable but the underlying element changes, so
      // bump contextVersion to force the renderer to re-initialize on the
      // new canvas.
      if (lastCanvasRef.current && lastCanvasRef.current !== canvas) {
        setContextVersion(v => v + 1)
      }
      lastCanvasRef.current = canvas
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    let cancelled = false
    let disposed = false
    const renderer = rendererCache.getOrCreate(canvas)
    rendererRef.current = renderer
    renderer
      .init()
      .then(ok => {
        if (cancelled) {
          return
        }
        if (!ok) {
          setError(new Error('GPU initialization failed'))
        } else {
          setReady(true)
          opts?.onReady?.(renderer)
        }
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
      if (!disposed) {
        disposed = true
        renderer.dispose()
      }
    }
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      cancelled = true
      if (!disposed) {
        disposed = true
        renderer.dispose()
      }
      rendererRef.current = null
      setReady(false)
      opts?.onDispose?.()
    }
    // opts callbacks (onReady/onDispose) are intentionally omitted from deps —
    // callers must pass stable references (e.g. useMemo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextVersion, rendererCache, canvasRef])

  function retry() {
    setError(null)
    setReady(false)
    setContextVersion(v => v + 1)
  }

  return { error, ready, rendererRef, retry }
}
