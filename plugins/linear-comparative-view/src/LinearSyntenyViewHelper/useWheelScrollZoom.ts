import { useEffect, useRef } from 'react'

import {
  applyZoomAccum,
  isActivelyZooming,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
  wheelZoomAccum,
} from '@jbrowse/core/util'
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
// thrashing all child views on every event. Deltas are normalized and the zoom
// step is computed via the shared wheelZoom helpers so this matches the LGV and
// breakpoint-overlay handlers exactly.
//
// Decision matrix (mirrors the LGV handler):
//   - ctrl/meta+wheel OR (scrollZoom && |dy|>=|dx|)  → zoom around cursor X
//   - otherwise, unless mid-zoom                     → horizontal pan by dx
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
  const lastZoomTimeRef = useRef<number | null>(null)
  const lastRafTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!canvas) {
      return undefined
    }
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    let scrollRaf: number | undefined
    let zoomRaf: number | undefined

    function flushHorizontalScroll() {
      if (scrollScheduledRef.current) {
        return
      }
      scrollScheduledRef.current = true
      scrollRaf = requestAnimationFrame(() => {
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
      zoomRaf = requestAnimationFrame(now => {
        const elapsed = wheelFrameElapsedMs(now, lastRafTimeRef.current)
        lastRafTimeRef.current = now
        const d = zoomAccumRef.current
        const canvasLeft = canvas!.getBoundingClientRect().left
        transaction(() => {
          for (const v of parentView.views) {
            v.zoomTo(
              applyZoomAccum(v.bpPerPx, d, elapsed),
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

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey
      if (
        isCtrlZoom ||
        (parentView.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))
      ) {
        zoomAccumRef.current += wheelZoomAccum(deltaY, isCtrlZoom)
        lastZoomClientXRef.current = event.clientX
        lastZoomTimeRef.current = event.timeStamp
        flushZoom()
      } else if (
        // ignore stray horizontal deltas that arrive mid-zoom — trackpads emit
        // an unintentional side-scroll during a pinch/scroll-zoom gesture that
        // would otherwise pan the view away from where the user is zooming
        !isActivelyZooming(event.timeStamp, lastZoomTimeRef.current)
      ) {
        scrollAccumXRef.current += deltaX
        flushHorizontalScroll()
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      clearTimeout(scrollTimer)
      // Cancel pending frames so a callback can't fire against a detached view
      // after unmount or a parentView swap. Reset the scheduled flags too, since
      // the refs outlive the effect.
      if (scrollRaf !== undefined) {
        cancelAnimationFrame(scrollRaf)
      }
      if (zoomRaf !== undefined) {
        cancelAnimationFrame(zoomRaf)
      }
      scrollScheduledRef.current = false
      zoomScheduledRef.current = false
    }
  }, [canvas, parentView])

  return { scrollingRef }
}
