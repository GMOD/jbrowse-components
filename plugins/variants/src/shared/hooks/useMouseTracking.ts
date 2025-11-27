import { useCallback, useRef, useState } from 'react'

import type { MouseState } from '../components/types'

/**
 * Hook for RAF-throttled mouse tracking within a container.
 * Returns mouse position relative to container and absolute screen offsets.
 */
export function useMouseTracking(ref: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const [mouseState, setMouseState] = useState<MouseState>()

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      const clientX = event.clientX
      const clientY = event.clientY
      rafRef.current = requestAnimationFrame(() => {
        const rect = ref.current?.getBoundingClientRect()
        if (rect) {
          setMouseState({
            x: clientX - rect.left,
            y: clientY - rect.top,
            offsetX: rect.left,
            offsetY: rect.top,
          })
        }
      })
    },
    [ref],
  )

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    setMouseState(undefined)
  }, [])

  return { mouseState, handleMouseMove, handleMouseLeave }
}
