import type React from 'react'
import { useEffect, useRef } from 'react'

import { sum } from '@jbrowse/core/util'

type Timer = ReturnType<typeof setTimeout>

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: {
    bpPerPx: number
    scrollZoom?: boolean
    zoomTo: (arg: number, arg2?: number) => void
    horizontalScroll: (arg: number) => void
  },
) {
  const ctrlZoomDelta = useRef(0)
  const scrollDelta = useRef(0)
  const timeout = useRef<Timer>(null)
  const rafId = useRef(0)
  const scheduled = useRef(false)
  const scrollZoomDelta = useRef(1)
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
        // there is no way to truly detect this, but it attempts to dynamically
        // toggle between normalization scheme depending on strength of deltaY,
        // particular due to the fact that this code path is triggered for both
        // normal ctrl+wheel scroll and pinch to zoom. for these two cases
        // - true wheel scroll has larger deltaY
        // - pinch-to-zoom has much smaller deltaY
        // though there is variation depending on platform
        samples.push(event.deltaY)
        const averageDeltaY = Math.abs(sum(samples)) / samples.length
        const normalizer =
          averageDeltaY < 6
            ? 25
            : averageDeltaY > 30
              ? averageDeltaY > 150
                ? 500
                : 150
              : 75
        ctrlZoomDelta.current += event.deltaY / normalizer
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          model.zoomTo(
            ctrlZoomDelta.current > 0
              ? model.bpPerPx * (1 + ctrlZoomDelta.current)
              : model.bpPerPx / (1 - ctrlZoomDelta.current),
            event.clientX - (curr?.getBoundingClientRect().left || 0),
          )
          ctrlZoomDelta.current = 0
          samples = []
        }, 300)
      } else if (
        model.scrollZoom &&
        Math.abs(event.deltaY) > Math.abs(event.deltaX)
      ) {
        event.preventDefault()
        // scrollZoom mode: apply zoom immediately per rAF for smooth updates
        const factor = 1 + Math.abs(event.deltaY) / 200
        const zoomFactor = event.deltaY > 0 ? factor : 1 / factor
        scrollZoomDelta.current *= zoomFactor
        lastZoomClientX.current = event.clientX
        if (!zoomScheduled.current) {
          zoomScheduled.current = true
          const baseBpPerPx = model.bpPerPx
          zoomRafId.current = window.requestAnimationFrame(() => {
            const newBpPerPx = baseBpPerPx * scrollZoomDelta.current
            model.zoomTo(
              newBpPerPx,
              lastZoomClientX.current -
                (curr?.getBoundingClientRect().left || 0),
            )
            scrollZoomDelta.current = 1
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
