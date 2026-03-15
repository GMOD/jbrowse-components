import { useEffect, useRef, useState } from 'react'

import { setupWebGLContextLossHandler } from './webglContextLoss.ts'

interface GpuRenderer {
  init(): Promise<boolean>
}

interface GpuRendererCache<R extends GpuRenderer> {
  getOrCreate(canvas: HTMLCanvasElement): R
}

/**
 * Shared hook for GPU renderer initialization, error handling, context loss
 * recovery, and retry. Used by wiggle, variant, and hic display components.
 *
 * Pattern:
 * 1. Canvas mounts → useEffect creates renderer via getOrCreate + init()
 * 2. WebGL context loss → contextVersion bumps → cleanup destroys old
 *    renderer → effect re-runs creating fresh renderer
 * 3. Error → ErrorBar with retry → retry resets state + bumps contextVersion
 *
 * Alignments uses a different pattern (renderer stored in MST model, rendering
 * driven by model autoruns) but follows the same contextVersion approach.
 */
export function useGpuRenderer<R extends GpuRenderer>(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  rendererCache: GpuRendererCache<R>,
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
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e)
        }
      })
    return () => {
      cancelled = true
      rendererRef.current = null
      setReady(false)
    }
  }, [contextVersion, rendererCache, canvasRef])

  function retry() {
    setError(null)
    setReady(false)
    setContextVersion(v => v + 1)
  }

  return { error, ready, rendererRef, retry }
}
