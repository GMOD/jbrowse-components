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
        // dynamically toggle between normalization scheme depending on true
        // wheel scroll (which has larger deltaY) or pinch-to-zoom (which has
        // much smaller deltaY)
        samples.push(event.deltaY)
        const averageDeltaY = Math.abs(sum(samples)) / samples.length
        const normalizer = averageDeltaY < 5 ? 25 : 500
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
        // this is needed to stop the event from triggering "back button
        // action" on MacOSX etc.  but is a heuristic to avoid preventing the
        // inner-track scroll behavior
        if (Math.abs(event.deltaX) > Math.abs(2 * event.deltaY)) {
          event.preventDefault()
        }
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
