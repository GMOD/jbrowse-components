import type React from 'react'
import { useEffect, useRef } from 'react'

import { sum } from '@jbrowse/core/util'

interface GenomeViewModel {
  bpPerPx: number
  scrollZoom?: boolean
  zoomTo: (bpPerPx: number, clientX?: number) => void
  horizontalScroll: (delta: number) => void
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

function getNormalizer(averageDeltaY: number): number {
  if (averageDeltaY < NORMALIZER_PINCH_THRESHOLD) {
    return NORMALIZER_PINCH_VALUE
  } else if (averageDeltaY > NORMALIZER_MID_THRESHOLD) {
    return averageDeltaY > NORMALIZER_HIGH_THRESHOLD
      ? NORMALIZER_VERY_HIGH_VALUE
      : NORMALIZER_HIGH_VALUE
  } else {
    return NORMALIZER_MID_VALUE
  }
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

    // if ctrl is held down, zoom in with y-scroll, else scroll horizontally
    // with x-scroll
    function onWheel(event: WheelEvent) {
      if (event.ctrlKey) {
        event.preventDefault()
        // Dynamically detect pinch-to-zoom vs wheel scroll by examining deltaY magnitude.
        // This is needed because pinch-to-zoom has smaller deltaY than wheel scroll.
        samples.push(event.deltaY)
        const averageDeltaY = Math.abs(sum(samples)) / samples.length
        const normalizer = getNormalizer(averageDeltaY)
        ctrlZoomDelta.current += event.deltaY / normalizer

        // Apply zoom immediately without debouncing
        model.zoomTo(
          ctrlZoomDelta.current > 0
            ? model.bpPerPx * (1 + ctrlZoomDelta.current)
            : model.bpPerPx / (1 - ctrlZoomDelta.current),
          event.clientX - (curr?.getBoundingClientRect().left || 0),
        )
        ctrlZoomDelta.current = 0
        samples = []
      } else if (
        model.scrollZoom &&
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ) {
        event.preventDefault()
        scrollZoomDelta.current += event.deltaY / SCROLL_ZOOM_FACTOR_DIVISOR
        lastZoomClientX.current = event.clientX
        if (!zoomScheduled.current) {
          zoomScheduled.current = true
          zoomRafId.current = window.requestAnimationFrame(() => {
            const d = scrollZoomDelta.current
            model.zoomTo(
              d > 0 ? model.bpPerPx * (1 + d) : model.bpPerPx / (1 - d),
              lastZoomClientX.current -
                (curr?.getBoundingClientRect().left || 0),
            )
            scrollZoomDelta.current = 0
            zoomScheduled.current = false
          })
        }
      } else {
        // this is needed to stop the event from triggering "back button
        // action" on MacOSX etc.  but is a heuristic to avoid preventing the
        // inner-track scroll behavior
        if (Math.abs(event.deltaX) > Math.abs(2 * event.deltaY)) {
          event.preventDefault()
        }
        scrollDelta.current += event.deltaX
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
