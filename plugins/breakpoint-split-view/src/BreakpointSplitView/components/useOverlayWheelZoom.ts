import { useEffect, useRef } from 'react'

import {
  accumulateScroll,
  applyZoomAccum,
  isActivelyZooming,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
  wheelZoomAccum,
} from '@jbrowse/core/util'

import type { BreakpointViewModel } from '../model.ts'

interface WheelState {
  scrollDelta: number
  zoomAccum: number
  lastClientX: number
  lastViewIndex: number
  rafId: number | null
  lastRafTime: number | null
  lastZoomTime: number | null
}

function viewIndexAtY(
  containers: NodeListOf<HTMLElement>,
  viewCount: number,
  clientY: number,
) {
  for (let i = 0; i < containers.length && i < viewCount; i++) {
    const rect = containers[i]!.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return i
    }
  }
  return 0
}

// Only fires when the pointer is over an overlay path: the overlay <div> paints
// below the views (which sit inside a position:relative wrapper), so it's the
// z-index:100 <svg>'s pointer-events:auto paths that receive the wheel. Every
// other point in the view goes to the LGV's own useWheelScroll, and the two must
// behave identically for the same gesture.
export function useOverlayWheelZoom(
  divRef: React.RefObject<HTMLDivElement | null>,
  views: BreakpointViewModel['views'],
) {
  const stateRef = useRef<WheelState>({
    scrollDelta: 0,
    zoomAccum: 0,
    lastClientX: 0,
    lastViewIndex: 0,
    rafId: null,
    lastRafTime: null,
    lastZoomTime: null,
  })

  useEffect(() => {
    const div = divRef.current
    if (!div || views.length === 0) {
      return
    }
    const s = stateRef.current
    // Scope the scan to the grid parent the overlay shares with the views: a
    // document-wide query also matches the track containers of every other view
    // open in the session, and indexing that list by level zooms the wrong view.
    const root = div.parentElement ?? document
    function trackContainers() {
      return root.querySelectorAll<HTMLElement>(
        '[data-testid="tracksContainer"]',
      )
    }

    function handleWheel(event: WheelEvent) {
      const target = event.target as Element
      if (!target.closest('svg')) {
        return
      }

      // The overlay is a CSS grid sibling of the views, not a child, so
      // event.target doesn't identify which view was scrolled. We resolve
      // the view by scanning all track containers and matching Y-coordinate.
      const containers = trackContainers()
      if (containers.length === 0) {
        return
      }
      const viewIndex = viewIndexAtY(containers, views.length, event.clientY)
      const view = views[viewIndex]
      if (!view?.zoomTo || (view.scrollZoom && event.shiftKey)) {
        return
      }

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey
      s.lastViewIndex = viewIndex

      if (
        isCtrlZoom ||
        (view.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))
      ) {
        event.preventDefault()
        s.zoomAccum += wheelZoomAccum(deltaY, isCtrlZoom)
        s.lastClientX = event.clientX
        s.lastZoomTime = event.timeStamp
        // drop any side-scroll accumulated earlier this frame — we're zooming,
        // and a deltaX that arrived just before the zoom is part of the same
        // noisy gesture
        s.scrollDelta = 0
      } else if (isActivelyZooming(event.timeStamp, s.lastZoomTime)) {
        // ignore stray horizontal deltas that arrive mid-zoom — trackpads emit
        // an unintentional side-scroll during a pinch/scroll-zoom gesture that
        // would otherwise pan the view away from where the user is zooming
        event.preventDefault()
      } else {
        // only swallow the native scroll when we are going to act on it, so a
        // plain vertical wheel with scrollZoom off isn't silently eaten by
        // whichever squiggle the pointer happens to be over
        if (view.scrollZoom || Math.abs(deltaX) > Math.abs(2 * deltaY)) {
          event.preventDefault()
        }
        s.scrollDelta = accumulateScroll(s.scrollDelta, deltaX)
      }

      // coalesce all wheel events into one model update per frame so a burst
      // (fast trackpad scrolling) doesn't drive one zoomTo/horizontalScroll per
      // event from inside the wheel handler
      s.rafId ??= requestAnimationFrame(now => {
        const elapsed = wheelFrameElapsedMs(now, s.lastRafTime)
        s.lastRafTime = now
        const v = views[s.lastViewIndex]
        if (v?.zoomTo) {
          const container = trackContainers()[s.lastViewIndex]
          if (s.zoomAccum !== 0 && container) {
            v.zoomTo(
              applyZoomAccum(v.bpPerPx, s.zoomAccum, elapsed),
              s.lastClientX - container.getBoundingClientRect().left,
            )
          }
          if (s.scrollDelta !== 0) {
            v.horizontalScroll(s.scrollDelta)
          }
        }
        s.zoomAccum = 0
        s.scrollDelta = 0
        s.rafId = null
      })
    }

    div.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      div.removeEventListener('wheel', handleWheel)
      if (s.rafId !== null) {
        cancelAnimationFrame(s.rafId)
      }
    }
  }, [views, divRef])
}
