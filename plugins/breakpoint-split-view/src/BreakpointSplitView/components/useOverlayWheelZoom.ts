import { useEffect, useRef } from 'react'

import type { BreakpointViewModel } from '../model.ts'

interface WheelState {
  zoomAccum: number
  lastClientX: number
  lastViewIndex: number
  rafId: number | null
  lastRafTime: number | null
}

// Mirrors the zoom normalizer in
// plugins/linear-genome-view/src/LinearGenomeView/components/useWheelScroll.ts.
// Keep in sync if you change the zoom logic there.
function getNormalizer(deltaY: number) {
  const abs = Math.abs(deltaY)
  if (abs < 6) {
    return 25
  }
  if (abs > 150) {
    return 500
  }
  if (abs > 30) {
    return 150
  }
  return 75
}

function normalizeWheel(delta: number, mode: number) {
  if (mode === 1) {
    return delta * 16
  }
  if (mode === 2) {
    return delta * 100
  }
  return delta
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
  const state = useRef<WheelState>({
    zoomAccum: 0,
    lastClientX: 0,
    lastViewIndex: 0,
    rafId: null,
    lastRafTime: null,
  })

  useEffect(() => {
    const div = divRef.current
    if (!div || views.length === 0) {
      return
    }
    const s = state.current

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

      const deltaY = normalizeWheel(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheel(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey

      if (
        isCtrlZoom ||
        (targetView.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))
      ) {
        event.preventDefault()
        s.zoomAccum += deltaY / getNormalizer(deltaY)
        s.lastClientX = event.clientX
        s.lastViewIndex = viewIndex
      } else {
        event.preventDefault()
        targetView.horizontalScroll(deltaX)
      }

      s.rafId ??= requestAnimationFrame(now => {
        const elapsed = Math.min(
          100,
          s.lastRafTime !== null ? now - s.lastRafTime : 16.67,
        )
        s.lastRafTime = now
        const maxZoomDelta = (0.2 / 16.67) * elapsed
        if (s.zoomAccum !== 0) {
          const view = views[s.lastViewIndex]
          const container = findTrackContainers()[s.lastViewIndex]
          if (view?.zoomTo && container) {
            const d = Math.max(
              -maxZoomDelta,
              Math.min(maxZoomDelta, s.zoomAccum),
            )
            view.zoomTo(
              d > 0 ? view.bpPerPx * (1 + d) : view.bpPerPx / (1 - d),
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
