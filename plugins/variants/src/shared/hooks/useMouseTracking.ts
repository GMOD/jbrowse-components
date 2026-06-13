import { useRef, useState } from 'react'

import type { MouseState } from '../components/types.ts'

export function useMouseTracking(ref: React.RefObject<HTMLDivElement | null>) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const [mouseState, setMouseState] = useState<MouseState>()

  const handleMouseMove = (event: React.MouseEvent) => {
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
          clientX,
          clientY,
        })
      }
    })
  }

  const handleMouseLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    setMouseState(undefined)
  }

  return { mouseState, handleMouseMove, handleMouseLeave }
}
