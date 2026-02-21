import type React from 'react'
import { useEffect, useRef } from 'react'

interface GenomeViewModel {
  bpPerPx: number
  scrollZoom?: boolean
  zoomTo: (bpPerPx: number, clientX?: number) => void
  horizontalScroll: (delta: number) => void
  setIsScrolling?: (val: boolean) => void
}

const SCROLL_ZOOM_FACTOR_DIVISOR = 500

// Ctrl+wheel normalizer thresholds for detecting pinch-to-zoom vs wheel scroll
const NORMALIZER_PINCH_THRESHOLD = 6
const NORMALIZER_PINCH_VALUE = 25
const NORMALIZER_MID_THRESHOLD = 30
const NORMALIZER_MID_VALUE = 75
const NORMALIZER_HIGH_THRESHOLD = 150
const NORMALIZER_HIGH_VALUE = 150
const NORMALIZER_VERY_HIGH_VALUE = 500

function getNormalizer(averageDeltaY: number) {
  if (averageDeltaY < NORMALIZER_PINCH_THRESHOLD) {
    return NORMALIZER_PINCH_VALUE
  }
  if (averageDeltaY > NORMALIZER_MID_THRESHOLD) {
    if (averageDeltaY > NORMALIZER_HIGH_THRESHOLD) {
      return NORMALIZER_VERY_HIGH_VALUE
    }
    return NORMALIZER_HIGH_VALUE
  }
  return NORMALIZER_MID_VALUE
}

// convert delta values to pixels depending on deltaMode
function normalizeWheel(delta: number, mode: number) {
  if (mode === 1) {
    // DOM_DELTA_LINE
    return delta * 16
  }
  if (mode === 2) {
    // DOM_DELTA_PAGE
    return delta * 100
  }
  return delta
}

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: GenomeViewModel,
) {
  // Ctrl+wheel zoom state
  const ctrlZoomDelta = useRef(0)

  // Horizontal scroll state
  const scrollDelta = useRef(0)
  const rafId = useRef(0)
  const scheduled = useRef(false)

  // Scroll-zoom state
  const scrollZoomDelta = useRef(0)
  const zoomScheduled = useRef(false)
  const zoomRafId = useRef(0)
  const lastZoomClientX = useRef(0)

  useEffect(() => {
    let samples = [] as number[]
    const curr = ref.current
    let scrollingTimer: ReturnType<typeof setTimeout> | undefined

    // When scrollZoom is off: ctrl+wheel zooms, regular wheel scrolls
    // When scrollZoom is on: regular wheel zooms, ctrl+wheel scrolls page (inverted)
    function onWheel(event: WheelEvent) {
      model.setIsScrolling?.(true)
      clearTimeout(scrollingTimer)
      scrollingTimer = setTimeout(() => {
        model.setIsScrolling?.(false)
      }, 150)

      // When scrollZoom is on and shift is held, allow default page scroll
      if (event.shiftKey && model.scrollZoom) {
        return
      }

      const deltaY = normalizeWheel(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheel(event.deltaX, event.deltaMode)

      console.log('[useWheelScroll]', performance.now().toFixed(2), JSON.stringify({
        deltaY,
        deltaX,
        deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey,
        scrollZoom: model.scrollZoom,
        absDeltaYgtX: Math.abs(deltaY) > Math.abs(deltaX),
        scrollZoomDelta: scrollZoomDelta.current,
        zoomScheduled: zoomScheduled.current,
      }))

      if (event.ctrlKey) {
        event.preventDefault()
        // Dynamically detect pinch-to-zoom vs wheel scroll by examining deltaY magnitude.
        // This is needed because pinch-to-zoom has smaller deltaY than wheel scroll.
        samples.push(Math.abs(deltaY))
        const averageDeltaY =
          samples.reduce((a, b) => a + b, 0) / samples.length
        const normalizer = getNormalizer(averageDeltaY)
        ctrlZoomDelta.current += deltaY / normalizer

        // Apply zoom immediately without debouncing
        model.zoomTo(
          ctrlZoomDelta.current > 0
            ? model.bpPerPx * (1 + ctrlZoomDelta.current)
            : model.bpPerPx / (1 - ctrlZoomDelta.current),
          event.clientX - (curr?.getBoundingClientRect().left || 0),
        )
        ctrlZoomDelta.current = 0
        samples = []
      } else if (model.scrollZoom && Math.abs(deltaY) > Math.abs(deltaX)) {
        event.preventDefault()
        const d = deltaY / SCROLL_ZOOM_FACTOR_DIVISOR
        console.log('[scrollZoom] immediate apply', performance.now().toFixed(2), JSON.stringify({ d, deltaY, bpPerPx: model.bpPerPx }))
        model.zoomTo(
          d > 0 ? model.bpPerPx * (1 + d) : model.bpPerPx / (1 - d),
          event.clientX - (curr?.getBoundingClientRect().left || 0),
        )
      } else {
        // this is needed to stop the event from triggering "back button
        // action" on MacOSX etc.  but is a heuristic to avoid preventing the
        // inner-track scroll behavior
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
        if (!scheduled.current) {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          scheduled.current = true
          rafId.current = window.requestAnimationFrame(() => {
            model.horizontalScroll(scrollDelta.current)
            scrollDelta.current = 0
            scheduled.current = false
          })
        }
      }
    }
    if (curr) {
      curr.addEventListener('wheel', onWheel, { passive: false })
      return () => {
        curr.removeEventListener('wheel', onWheel)
        clearTimeout(scrollingTimer)
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
        if (zoomRafId.current) {
          cancelAnimationFrame(zoomRafId.current)
        }
      }
    }
    return () => {}
  }, [model, ref])
}
