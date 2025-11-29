import type React from 'react'
import { useEffect, useRef } from 'react'

import { sum } from '@jbrowse/core/util'

type Timer = ReturnType<typeof setTimeout>

export function useWheelScroll(
  ref: React.RefObject<HTMLDivElement | null>,
  model: {
    bpPerPx: number
    zoomTo: (arg: number, arg2?: number) => void
    setScaleFactor: (arg: number) => void
    horizontalScroll: (arg: number) => void
  },
) {
  const delta = useRef(0)
  const timeout = useRef<Timer>(null)
  const scheduled = useRef(false)

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
        delta.current += event.deltaY / normalizer
        model.setScaleFactor(
          delta.current < 0 ? 1 - delta.current : 1 / (1 + delta.current),
        )
        if (timeout.current) {
          clearTimeout(timeout.current)
        }
        timeout.current = setTimeout(() => {
          model.setScaleFactor(1)
          model.zoomTo(
            delta.current > 0
              ? model.bpPerPx * (1 + delta.current)
              : model.bpPerPx / (1 - delta.current),
            event.clientX - (curr?.getBoundingClientRect().left || 0),
          )
          delta.current = 0
          samples = []
        }, 300)
      } else {
        // Don't do horizontal scrolling if a virtual scrollbar is being dragged
        if (document.body.getAttribute('data-virtual-scrollbar-dragging')) {
          return
        }

        // Use original heuristic but be more conservative to allow page scrolling
        // Only prevent default when horizontal wheel is significantly greater than vertical
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          event.preventDefault()
        }

        // Handle horizontal scrolling
        delta.current += event.deltaX
        if (!scheduled.current) {
          // use rAF to make it so multiple event handlers aren't fired per-frame
          // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(delta.current)
            delta.current = 0
            scheduled.current = false
          })
        }
      }
    }
    if (curr) {
      curr.addEventListener('wheel', onWheel)
      return () => {
        curr.removeEventListener('wheel', onWheel)
      }
    }
    return () => {}
  }, [model, ref])
}
