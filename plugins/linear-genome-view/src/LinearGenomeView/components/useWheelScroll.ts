import type React from 'react'
import { useEffect, useRef } from 'react'

import {
  applyZoomAccum,
  getZoomNormalizer,
  normalizeWheelDelta,
  wheelFrameElapsedMs,
} from '@jbrowse/core/util'

interface GenomeViewModel {
  bpPerPx: number
  scrollZoom?: boolean
  zoomTo: (bpPerPx: number, offset?: number) => void
  horizontalScroll: (delta: number) => void
}

const SCROLL_ZOOM_FACTOR_DIVISOR = 500

interface WheelState {
  scrollDelta: number
  zoomAccum: number
  lastClientX: number
  rectLeft: number
  rafId: number | null
  lastRafTime: number | null
}

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: GenomeViewModel,
) {
  const stateRef = useRef<WheelState>({
    scrollDelta: 0,
    zoomAccum: 0,
    lastClientX: 0,
    rectLeft: 0,
    rafId: null,
    lastRafTime: null,
  })

  useEffect(() => {
    const curr = ref.current
    if (!curr) {
      return
    }

    const s = stateRef.current

    // cache the element's left position via ResizeObserver to avoid calling
    // getBoundingClientRect() inside the wheel handler, which forces a
    // synchronous layout reflow and causes "[Violation] 'wheel' handler took
    // Nms" warnings. event.offsetX would be simpler but is unreliable here
    // since wheel events bubble from child elements
    s.rectLeft = curr.getBoundingClientRect().left
    const hasRO = typeof window !== 'undefined' && 'ResizeObserver' in window
    const observer = hasRO
      ? new ResizeObserver(() => {
          s.rectLeft = curr.getBoundingClientRect().left
        })
      : undefined
    observer?.observe(curr)

    // the handler must be non-passive (passive: false) so we can
    // preventDefault to suppress native scroll during zoom. to compensate,
    // the handler only accumulates deltas — all heavy work (model.zoomTo,
    // model.horizontalScroll) is deferred to a single requestAnimationFrame
    function onWheel(event: WheelEvent) {
      if (event.shiftKey && model.scrollZoom) {
        return
      }

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey
      const isScrollZoom =
        model.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX)

      if (isCtrlZoom || isScrollZoom) {
        if (!event.cancelable) {
          console.warn(
            '[useWheelScroll] wheel event not cancelable — scroll sequence already in progress',
            { deltaY: event.deltaY, deltaX: event.deltaX },
          )
        }
        event.preventDefault()
        s.zoomAccum +=
          deltaY /
          (isCtrlZoom ? getZoomNormalizer(deltaY) : SCROLL_ZOOM_FACTOR_DIVISOR)
        s.lastClientX = event.clientX
      } else {
        // when scrollZoom is on, always preventDefault to stop the page
        // from scrolling on diagonal trackpad gestures that fall outside
        // the zoom threshold (shift+scroll is the escape hatch for native
        // scroll). without this, events where |deltaX| slightly exceeds
        // |deltaY| slip through the isScrollZoom check and cause the
        // browser to scroll the page instead of zooming.
        if (model.scrollZoom || Math.abs(deltaX) > Math.abs(2 * deltaY)) {
          event.preventDefault()
        }
        if (
          s.scrollDelta !== 0 &&
          Math.sign(deltaX) !== Math.sign(s.scrollDelta)
        ) {
          s.scrollDelta = 0
        }
        s.scrollDelta += deltaX
      }

      // coalesce all wheel events into one update per frame so that bursts
      // of events (e.g. fast trackpad scrolling) don't each trigger expensive
      // model updates
      s.rafId ??= requestAnimationFrame(now => {
        const elapsed = wheelFrameElapsedMs(now, s.lastRafTime)
        s.lastRafTime = now
        if (s.zoomAccum !== 0) {
          model.zoomTo(
            applyZoomAccum(model.bpPerPx, s.zoomAccum, elapsed),
            s.lastClientX - s.rectLeft,
          )
          s.zoomAccum = 0
        }
        if (s.scrollDelta !== 0) {
          model.horizontalScroll(s.scrollDelta)
          s.scrollDelta = 0
        }
        s.rafId = null
      })
    }

    // when returning to a backgrounded tab, lastRafTime is from before the
    // tab was hidden — a huge `elapsed` would cap zoomAccum oddly on the first
    // frame back. Reset it so the next rAF treats itself as the first frame.
    function onVisibilityChange() {
      if (!document.hidden) {
        s.lastRafTime = null
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    curr.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      curr.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      observer?.disconnect()
      if (s.rafId !== null) {
        cancelAnimationFrame(s.rafId)
      }
    }
  }, [model, ref])
}
