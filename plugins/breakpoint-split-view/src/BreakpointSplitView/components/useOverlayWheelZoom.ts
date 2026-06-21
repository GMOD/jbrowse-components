import { useEffect, useRef } from 'react'

import {
  applyZoomAccum,
  getZoomNormalizer,
  isActivelyZooming,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
} from '@jbrowse/core/util'

import type { BreakpointViewModel } from '../model.ts'

interface WheelState {
  zoomAccum: number
  lastClientX: number
  lastViewIndex: number
  rafId: number | null
  lastRafTime: number | null
  lastZoomTime: number | null
}

function findTrackContainers() {
  return document.querySelectorAll<HTMLElement>(
    '[data-testid="tracksContainer"]',
  )
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

export function useOverlayWheelZoom(
  divRef: React.RefObject<HTMLDivElement | null>,
  views: BreakpointViewModel['views'],
) {
  const stateRef = useRef<WheelState>({
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

    function handleWheel(event: WheelEvent) {
      const target = event.target as Element
      if (!target.closest('svg')) {
        return
      }

      // The overlay is a CSS grid sibling of the views, not a child, so
      // event.target doesn't identify which view was scrolled. We resolve
      // the view by scanning all track containers and matching Y-coordinate.
      const containers = findTrackContainers()
      if (containers.length === 0) {
        return
      }
      const viewIndex = viewIndexAtY(containers, views.length, event.clientY)
      const targetView = views[viewIndex]
      if (!targetView?.zoomTo) {
        return
      }

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey

      if (
        isCtrlZoom ||
        (targetView.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))
      ) {
        event.preventDefault()
        s.zoomAccum += deltaY / getZoomNormalizer(deltaY)
        s.lastClientX = event.clientX
        s.lastViewIndex = viewIndex
        s.lastZoomTime = event.timeStamp
      } else {
        event.preventDefault()
        // ignore stray horizontal deltas that arrive mid-zoom — trackpads emit
        // an unintentional side-scroll during a pinch/scroll-zoom gesture that
        // would otherwise pan the view away from where the user is zooming
        if (!isActivelyZooming(event.timeStamp, s.lastZoomTime)) {
          targetView.horizontalScroll(deltaX)
        }
      }

      s.rafId ??= requestAnimationFrame(now => {
        const elapsed = wheelFrameElapsedMs(now, s.lastRafTime)
        s.lastRafTime = now
        if (s.zoomAccum !== 0) {
          const view = views[s.lastViewIndex]
          const container = findTrackContainers()[s.lastViewIndex]
          if (view?.zoomTo && container) {
            view.zoomTo(
              applyZoomAccum(view.bpPerPx, s.zoomAccum, elapsed),
              s.lastClientX - container.getBoundingClientRect().left,
            )
          }
          s.zoomAccum = 0
        }
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
