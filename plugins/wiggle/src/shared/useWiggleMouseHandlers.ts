import { useRef } from 'react'

import { useMouseTracking } from '@jbrowse/core/ui'

const COORD0: [number, number] = [0, 0]

interface MouseTrackingModel<T> {
  setFeatureUnderMouse: (feat?: T) => void
  selectFeature: (feat: T) => void
}

// Hover/select wiring for the wiggle-family display components, over the shared
// `useMouseTracking` measurement — so the hit, the tooltip, and the cursor guides
// all come off one container rect in one frame. Single- and multi-wiggle differ
// only in how a hit is resolved (one source vs row/overlay), so that stays a
// callback.
export function useWiggleMouseHandlers<T>(
  model: MouseTrackingModel<T>,
  computeHit: (offsetX: number, offsetY: number) => T | undefined,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mouseState, handleMouseMove, handleMouseLeave } = useMouseTracking(
    containerRef,
    state => {
      model.setFeatureUnderMouse(
        state ? computeHit(state.x, state.y) : undefined,
      )
    },
  )
  // Resolved from the click itself rather than from the hover a previous frame
  // recorded, which can be stale — the viewport moves under a stationary cursor.
  const handleClick = (event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const feat = computeHit(
        event.clientX - rect.left,
        event.clientY - rect.top,
      )
      if (feat) {
        model.selectFeature(feat)
      }
    }
  }
  const clientMouseCoord: [number, number] = mouseState
    ? [mouseState.clientX, mouseState.clientY]
    : COORD0
  const offsetMouseCoord: [number, number] = mouseState
    ? [mouseState.x, mouseState.y]
    : COORD0

  return {
    containerRef,
    clientMouseCoord,
    offsetMouseCoord,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  }
}
