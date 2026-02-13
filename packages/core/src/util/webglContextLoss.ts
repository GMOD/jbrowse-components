import { useEffect, useRef, useState } from 'react'

export function setupWebGLContextLossHandler(
  canvas: HTMLCanvasElement,
  onRestore: () => void,
) {
  const handleContextLost = (e: Event) => {
    e.preventDefault()
  }
  const handleContextRestored = () => {
    onRestore()
  }
  canvas.addEventListener('webglcontextlost', handleContextLost)
  canvas.addEventListener('webglcontextrestored', handleContextRestored)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleContextLost)
    canvas.removeEventListener('webglcontextrestored', handleContextRestored)
  }
}

/**
 * Manages a WebGL renderer lifecycle with automatic context loss recovery.
 *
 * On context restore: destroys the old renderer, creates a new one, and calls
 * onRecreated so callers can clear any upload caches.
 *
 * Returns `contextVersion` — add this to useEffect deps for data upload and
 * render effects so they re-run after recovery.
 */
export function useWebGLRenderer<T extends { destroy(): void }>(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  create: (canvas: HTMLCanvasElement) => T,
  options?: {
    onRecreated?: () => void
    onError?: (e: unknown) => void
  },
) {
  const rendererRef = useRef<T | null>(null)
  const [contextVersion, setContextVersion] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      return setupWebGLContextLossHandler(canvas, () => {
        setContextVersion(v => v + 1)
      })
    }
    return undefined
  }, [canvasRef])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    try {
      rendererRef.current = create(canvas)
      if (contextVersion > 0) {
        options?.onRecreated?.()
      }
    } catch (e) {
      options?.onError?.(e)
    }
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [contextVersion])

  return { rendererRef, contextVersion }
}
