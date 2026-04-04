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
    return () => {
      cancelled = true
      renderer.dispose()
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
