import { useEffect, useRef } from 'react'

import { transaction } from 'mobx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface ParentViewDuck {
  views: LinearGenomeViewModel[]
  scrollZoom: boolean
}

interface UseWheelScrollZoomResult {
  // True while wheel events are firing (cleared 150ms after the last event).
  // Callers can read `.current` from a render-phase event handler to suppress
  // pick dispatch during scroll — pick under wheel-scroll feels laggy.
  scrollingRef: React.RefObject<boolean>
}

// Wheel event manager for the synteny canvas. Accumulates deltas across the
// frame and applies them in a single MobX transaction on the next rAF, so
// inertial-scroll bursts collapse to one model update per frame instead of
// thrashing all child views on every event.
//
// Decision matrix:
//   - ctrl+wheel OR (scrollZoom && |dy|>|dx|)  → zoom around cursor X
//   - |dy| < |dx|                              → horizontal pan
//   - anything else                            → ignored (vertical scroll
//                                                bypasses the canvas)
export function useWheelScrollZoom(
  canvas: HTMLCanvasElement | null,
  parentView: ParentViewDuck,
): UseWheelScrollZoomResult {
  const scrollingRef = useRef(false)
  const scrollAccumXRef = useRef(0)
  const scrollScheduledRef = useRef(false)
  const zoomAccumRef = useRef(0)
  const zoomScheduledRef = useRef(false)
  const lastZoomClientXRef = useRef(0)

  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    let scrollTimer: ReturnType<typeof setTimeout> | undefined

    function flushHorizontalScroll() {
      if (scrollScheduledRef.current) {
        return
      }
      scrollScheduledRef.current = true
      requestAnimationFrame(() => {
        transaction(() => {
          for (const v of parentView.views) {
            v.horizontalScroll(scrollAccumXRef.current)
          }
        })
        scrollAccumXRef.current = 0
        scrollScheduledRef.current = false
      })
    }

    function flushZoom() {
      if (zoomScheduledRef.current) {
        return
      }
      zoomScheduledRef.current = true
      requestAnimationFrame(() => {
        const d = zoomAccumRef.current
        const canvasLeft = canvas!.getBoundingClientRect().left
        transaction(() => {
          for (const v of parentView.views) {
            v.zoomTo(
              d > 0 ? v.bpPerPx * (1 + d) : v.bpPerPx / (1 - d),
              lastZoomClientXRef.current - canvasLeft,
            )
          }
        })
        zoomAccumRef.current = 0
        zoomScheduledRef.current = false
      })
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault()
      scrollingRef.current = true
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => {
        scrollingRef.current = false
      }, 150)

      const doZoom =
        event.ctrlKey ||
        (parentView.scrollZoom &&
          Math.abs(event.deltaY) > Math.abs(event.deltaX))
      if (doZoom) {
        zoomAccumRef.current += event.deltaY / 500
        lastZoomClientXRef.current = event.clientX
        flushZoom()
      } else if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
        scrollAccumXRef.current += event.deltaX / 2
        flushHorizontalScroll()
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      clearTimeout(scrollTimer)
    }
  }, [canvas, parentView])

  return { scrollingRef }
}
