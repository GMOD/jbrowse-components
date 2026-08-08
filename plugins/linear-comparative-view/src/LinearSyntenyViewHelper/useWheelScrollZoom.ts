import { useEffect, useRef } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
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
// `onUnhandled` is the scroll-to-zoom prompt's signal, and it matters more here
// than over a track. Because of `swallowUnhandled` above, a plain vertical wheel
// with scroll-to-zoom off doesn't even fall through to the page — it does
// nothing at all, every time. Wheel over the ribbons and get silence, wheel
// twenty pixels higher over a track and get told how to zoom, was the state of
// things before this was wired.
export function useWheelScrollZoom(
  canvas: HTMLCanvasElement | null,
  parentView: ParentViewDuck,
  onUnhandled?: (event: WheelEvent) => void,
): UseWheelScrollZoomResult {
  const scrollingRef = useRef(false)
  // stable, so a caller passing an inline closure doesn't rebind the listener
  // every render
  const notify = useEventCallback((event: WheelEvent) => {
    onUnhandled?.(event)
  })

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
      onUnhandled: notify,
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
  }, [canvas, parentView, notify])

  return { scrollingRef }
}
