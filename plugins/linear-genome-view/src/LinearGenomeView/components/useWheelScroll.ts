import type React from 'react'
import { useEffect, useRef } from 'react'

interface GenomeViewModel {
  bpPerPx: number
  scrollZoom?: boolean
  zoomTo: (bpPerPx: number, clientX?: number) => void
  horizontalScroll: (delta: number) => void
}

const SCROLL_ZOOM_FACTOR_DIVISOR = 500
// max zoom delta per millisecond — equivalent to 0.2 per frame at 60fps
const MAX_ZOOM_RATE_PER_MS = 0.2 / 16.67

// NOTE: The getNormalizer function and zoom logic below are also implemented in
// plugins/breakpoint-split-view/src/BreakpointSplitView/components/BreakpointSplitViewOverlay.tsx
// If you modify the normalizer logic or zoom calculations here, you must also update
// the corresponding code in BreakpointSplitViewOverlay.tsx to keep wheel zoom behavior
// consistent across all genome views.

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

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: GenomeViewModel,
) {
  const scrollDelta = useRef(0)
  const zoomDelta = useRef(0)
  const zoomDivisor = useRef(0)
  const lastClientX = useRef(0)
  const rectLeft = useRef(0)
  const rafId = useRef<number | null>(null)
  const lastRafTime = useRef<number | null>(null)

  useEffect(() => {
    const curr = ref.current
    if (!curr) {
      return () => {}
    }

    // cache the element's left position via ResizeObserver to avoid calling
    // getBoundingClientRect() inside the wheel handler, which forces a
    // synchronous layout reflow and causes "[Violation] 'wheel' handler took
    // Nms" warnings. event.offsetX would be simpler but is unreliable here
    // since wheel events bubble from child elements
    rectLeft.current = curr.getBoundingClientRect().left
    const observer = new ResizeObserver(() => {
      rectLeft.current = curr.getBoundingClientRect().left
    })
    observer.observe(curr)

    // the handler must be non-passive (passive: false) so we can
    // preventDefault to suppress native scroll during zoom. to compensate,
    // the handler only accumulates deltas — all heavy work (model.zoomTo,
    // model.horizontalScroll) is deferred to a single requestAnimationFrame
    function onWheel(event: WheelEvent) {
      if (event.shiftKey && model.scrollZoom) {
        return
      }

      const deltaY = normalizeWheel(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheel(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey
      const isScrollZoom =
        model.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX)

      if (isCtrlZoom || isScrollZoom) {
        event.preventDefault()
        zoomDelta.current += deltaY
        zoomDivisor.current = isCtrlZoom
          ? getNormalizer(deltaY)
          : SCROLL_ZOOM_FACTOR_DIVISOR
        lastClientX.current = event.clientX
      } else {
        if (Math.abs(deltaX) > Math.abs(2 * deltaY)) {
          event.preventDefault()
        }
        if (
          scrollDelta.current !== 0 &&
          Math.sign(deltaX) !== Math.sign(scrollDelta.current)
        ) {
          scrollDelta.current = 0
        }
        scrollDelta.current += deltaX
      }

      // coalesce all wheel events into one update per frame so that bursts
      // of events (e.g. fast trackpad scrolling) don't each trigger expensive
      // model updates
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(now => {
          const elapsed = Math.min(
            100,
            lastRafTime.current !== null ? now - lastRafTime.current : 16.67,
          )
          lastRafTime.current = now
          const maxZoomDelta = MAX_ZOOM_RATE_PER_MS * elapsed
          if (zoomDelta.current !== 0) {
            const d = Math.max(
              -maxZoomDelta,
              Math.min(maxZoomDelta, zoomDelta.current / zoomDivisor.current),
            )
            model.zoomTo(
              d > 0 ? model.bpPerPx * (1 + d) : model.bpPerPx / (1 - d),
              lastClientX.current - rectLeft.current,
            )
            zoomDelta.current = 0
          }
          if (scrollDelta.current !== 0) {
            model.horizontalScroll(scrollDelta.current)
            scrollDelta.current = 0
          }
          rafId.current = null
        })
      }
    }

    curr.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      curr.removeEventListener('wheel', onWheel)
      observer.disconnect()
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [model, ref])
}
