import { useCallback, useRef, useState } from 'react'

export interface MouseState {
  y: number
}

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
      const clientY = event.clientY
      rafRef.current = requestAnimationFrame(() => {
        const rect = ref.current?.getBoundingClientRect()
        if (rect) {
          setMouseState({
            y: clientY - rect.top,
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

  return {
    mouseState,
    handleMouseMove,
    handleMouseLeave,
  }
}
