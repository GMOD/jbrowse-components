import { useRef } from 'react'

import { useMouseState, useMouseTracking } from '@jbrowse/core/ui'

import type { MouseTracker } from '@jbrowse/core/ui'

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
//
// Returns the tracker, not the coordinates: this runs in the component that
// mounts `DisplayChrome`, so holding the position here would re-render the whole
// chrome on every mousemove. The body calls `useWiggleMouseCoords` — see
// `useMouseTracking`.
export function useWiggleMouseHandlers<T>(
  model: MouseTrackingModel<T>,
  computeHit: (offsetX: number, offsetY: number) => T | undefined,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { mouseTracker, handleMouseMove, handleMouseLeave } = useMouseTracking(
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

  return {
    containerRef,
    mouseTracker,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  }
}

// The two coordinate pairs the wiggle-family bodies draw with: client-space for
// the tooltip (which portals to the document) and container-relative for the
// cursor guides. Call it in the body, not beside `useWiggleMouseHandlers`.
export function useWiggleMouseCoords(mouseTracker: MouseTracker) {
  const mouseState = useMouseState(mouseTracker)
  const clientMouseCoord: [number, number] = mouseState
    ? [mouseState.clientX, mouseState.clientY]
    : COORD0
  const offsetMouseCoord: [number, number] = mouseState
    ? [mouseState.x, mouseState.y]
    : COORD0
  return { clientMouseCoord, offsetMouseCoord }
}
