import type React from 'react'
import { useEffect, useRef } from 'react'

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
  // Horizontal scroll state
  const scrollDelta = useRef(0)
  const rafId = useRef(0)
  const scheduled = useRef(false)

  useEffect(() => {
    let samples = [] as number[]
    const curr = ref.current

    // When scrollZoom is off: ctrl+wheel zooms, regular wheel scrolls
    // When scrollZoom is on: regular wheel zooms, ctrl+wheel scrolls page (inverted)
    function onWheel(event: WheelEvent) {
      // When scrollZoom is on and shift is held, allow default page scroll
      if (event.shiftKey && model.scrollZoom) {
        return
      }

      const deltaY = normalizeWheel(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheel(event.deltaX, event.deltaMode)

      if (event.ctrlKey) {
        event.preventDefault()
        samples.push(Math.abs(deltaY))
        const averageDeltaY =
          samples.reduce((a, b) => a + b, 0) / samples.length
        const d = deltaY / getNormalizer(averageDeltaY)
        model.zoomTo(
          d > 0 ? model.bpPerPx * (1 + d) : model.bpPerPx / (1 - d),
          event.clientX - (curr?.getBoundingClientRect().left || 0),
        )
        samples = []
      } else if (model.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX)) {
        event.preventDefault()
        const d = deltaY / SCROLL_ZOOM_FACTOR_DIVISOR
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
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
        }
      }
    }
    return () => {}
  }, [model, ref])
}
