import type React from 'react'
import { useEffect, useRef } from 'react'

import { sum } from '@jbrowse/core/util'

type Timer = ReturnType<typeof setTimeout>

interface GenomeViewModel {
  bpPerPx: number
  offsetPx: number
  scrollZoom?: boolean
  minBpPerPx: number
  maxBpPerPx: number
  dynamicBlocks?: {
    contentBlocks?: {
      refName: string
      start: number
      end: number
      offsetPx?: number
    }[]
  }
  setNewView: (bpPerPx: number, offsetPx: number) => void
  zoomTo: (bpPerPx: number, clientX?: number) => void
  horizontalScroll: (delta: number) => void
}

// Timing constants
const CTRL_ZOOM_DEBOUNCE_MS = 300
const SCROLL_ZOOM_FACTOR_DIVISOR = 500
const SCROLL_ZOOM_FACTOR_EASING = 0.4

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
  const timeout = useRef<Timer>(null)

  // Horizontal scroll state
  const scrollDelta = useRef(0)
  const rafId = useRef(0)
  const scheduled = useRef(false)

  // Scroll-zoom state
  const scrollZoomDelta = useRef(1)
  const zoomScheduled = useRef(false)
  const zoomRafId = useRef(0)
  const lastZoomClientX = useRef(0)
  const lastZoomDirection = useRef(0)

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
        console.log(
          '[scrollZoom] event deltaY:',
          event.deltaY,
          'clientX:',
          event.clientX,
        )

        // scrollZoom mode: apply zoom immediately per rAF for smooth updates.
        // Detect direction changes and cancel pending rAF to reset base zoom level.
        const currentDirection = event.deltaY > 0 ? 1 : -1
        if (
          lastZoomDirection.current !== 0 &&
          lastZoomDirection.current !== currentDirection &&
          zoomScheduled.current
        ) {
          // Direction reversed - cancel pending rAF and reset for new direction
          console.log('[scrollZoom] direction changed, cancelling pending rAF')
          cancelAnimationFrame(zoomRafId.current)
          scrollZoomDelta.current = 1
          zoomScheduled.current = false
        }
        lastZoomDirection.current = currentDirection

        // Use larger divisor for subtle zoom
        const factor = 1 + Math.abs(event.deltaY) / SCROLL_ZOOM_FACTOR_DIVISOR
        const zoomFactor = event.deltaY > 0 ? factor : 1 / factor
        // const easedFactor = Math.pow(zoomFactor, SCROLL_ZOOM_FACTOR_EASING)
        // scrollZoomDelta.current *= easedFactor
        scrollZoomDelta.current *= zoomFactor
        console.log(
          '[scrollZoom] factor:',
          factor.toFixed(4),
          'zoomFactor:',
          zoomFactor.toFixed(4),
          'accumulated scrollZoomDelta:',
          scrollZoomDelta.current.toFixed(4),
        )

        lastZoomClientX.current = event.clientX
        if (!zoomScheduled.current) {
          zoomScheduled.current = true
          const baseBpPerPx = model.bpPerPx
          const baseOffsetPx = model.offsetPx
          const rect = curr?.getBoundingClientRect()
          const canvasWidth = rect?.width
          const clientXOffset = lastZoomClientX.current - (rect?.left || 0)

          console.log(
            '[scrollZoom] scheduling rAF, baseBpPerPx:',
            baseBpPerPx.toFixed(4),
            'canvasWidth:',
            canvasWidth,
            'clientXOffset:',
            clientXOffset.toFixed(2),
          )

          zoomRafId.current = window.requestAnimationFrame(() => {
            if (!canvasWidth) {
              zoomScheduled.current = false
              return
            }

            const newBpPerPx = baseBpPerPx * scrollZoomDelta.current

            // Calculate proper offsetPx to keep mouse position fixed
            // This is the same calculation used in individual track renderers
            const dynamicBlocks = model.dynamicBlocks?.contentBlocks
            const first = dynamicBlocks?.[0]

            console.log('[scrollZoom] rAF executing:')
            console.log('  baseBpPerPx:', baseBpPerPx.toFixed(4))
            console.log(
              '  scrollZoomDelta:',
              scrollZoomDelta.current.toFixed(4),
            )
            console.log('  newBpPerPx:', newBpPerPx.toFixed(4))

            if (first) {
              // Calculate visible bp range from current view state
              const blockOffsetPx = first.offsetPx ?? 0
              const assemblyOrigin = first.start - blockOffsetPx * baseBpPerPx
              const deltaPx = baseOffsetPx - blockOffsetPx
              const deltaBp = deltaPx * baseBpPerPx
              const rangeStart = first.start + deltaBp
              const rangeWidth = canvasWidth * baseBpPerPx
              const rangeEnd = rangeStart + rangeWidth

              // Calculate genomic position under mouse
              const mouseFraction = clientXOffset / canvasWidth
              const mouseBp = rangeStart + rangeWidth * mouseFraction

              // Calculate new range position
              const newRangeWidth = canvasWidth * newBpPerPx
              const newRangeStart = mouseBp - mouseFraction * newRangeWidth
              const newOffsetPx = (newRangeStart - assemblyOrigin) / newBpPerPx

              console.log('  mouseBp:', mouseBp.toFixed(0))
              console.log('  newOffsetPx:', newOffsetPx.toFixed(2))

              // Check zoom limits
              if (
                newBpPerPx >= model.minBpPerPx &&
                newBpPerPx <= model.maxBpPerPx
              ) {
                model.setNewView(newBpPerPx, newOffsetPx)
              }
            }

            scrollZoomDelta.current = 1
            lastZoomDirection.current = 0
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
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
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
