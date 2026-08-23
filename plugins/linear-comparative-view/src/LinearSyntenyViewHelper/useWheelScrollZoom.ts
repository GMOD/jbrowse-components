import { useEffect, useRef } from 'react'

import { createWheelZoomController } from '@jbrowse/core/util/wheelZoom'

import type { ParentViewDuck } from './parentViewDuck.ts'

interface UseWheelScrollZoomResult {
  // True while wheel events are firing (cleared 150ms after the last event).
  // Callers can read `.current` from a render-phase event handler to suppress
  // pick dispatch during scroll — pick under wheel-scroll feels laggy.
  scrollingRef: React.RefObject<boolean>
}

const SCROLL_IDLE_MS = 150

// Wheel handling for the synteny canvas: the shared controller drives every view
// in the stack from one gesture, so the connectors and both flanking LGVs stay in
// step, and the canvas swallows gestures it doesn't act on rather than letting
// the page jump out from under a connector.
//
// `swallowUnhandled` is why a plain vertical wheel with scroll-to-zoom off does
// nothing at all here rather than scrolling the page: the band is a few dozen
// pixels of ribbon between two views, and a page that jumps mid-gesture takes
// the connector the user was following with it.
export function useWheelScrollZoom(
  canvas: HTMLCanvasElement | null,
  parentView: ParentViewDuck,
): UseWheelScrollZoomResult {
  const scrollingRef = useRef(false)

  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    const dispose = createWheelZoomController({
      element: canvas,
      swallowUnhandled: true,
      onEvent: () => {
        scrollingRef.current = true
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          scrollingRef.current = false
        }, SCROLL_IDLE_MS)
      },
      resolveTarget: () => ({
        views: parentView.views,
        scrollZoom: parentView.scrollZoom,
        originElement: () => canvas,
      }),
    })
    return () => {
      dispose()
      clearTimeout(scrollTimer)
    }
  }, [canvas, parentView])

  return { scrollingRef }
}
