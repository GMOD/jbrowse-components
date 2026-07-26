import { useRef, useState } from 'react'

export interface MouseState {
  x: number
  y: number
  clientX: number
  clientY: number
}

/**
 * Container-relative mouse position for the overlays that follow the pointer
 * (`Crosshairs`, tooltips), coalesced to one update per frame.
 *
 * Bind the handlers and the ref to the same element — the position is measured
 * against that element's box, which is what the overlays are positioned in. A
 * display that also hit-tests takes `onMove`, so its hit and its guides come off
 * one measurement in one frame instead of two pointer paths that have to agree.
 */
export function useMouseTracking(
  ref: React.RefObject<HTMLDivElement | null>,
  onMove?: (state?: MouseState) => void,
) {
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
        const state = {
          x: clientX - rect.left,
          y: clientY - rect.top,
          clientX,
          clientY,
        }
        setMouseState(state)
        onMove?.(state)
      }
    })
  }

  const handleMouseLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    setMouseState(undefined)
    onMove?.(undefined)
  }

  return { mouseState, handleMouseMove, handleMouseLeave }
}
