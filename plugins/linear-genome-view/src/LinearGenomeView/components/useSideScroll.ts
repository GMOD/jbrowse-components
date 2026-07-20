import { useEffect, useRef, useState } from 'react'

import type { LinearGenomeViewModel } from '../index.ts'
import type React from 'react'

export function useSideScroll(model: LinearGenomeViewModel) {
  const [mouseDragging, setMouseDragging] = useState(false)
  // refs are to store these variables to avoid repeated rerenders associated
  // with useState/setState
  const scheduledRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const prevXRef = useRef(0)
  const currXRef = useRef(0)

  useEffect(() => {
    // apply the movement accumulated since the previous frame, then advance the
    // baseline. shared by the rAF tick and the mouseup flush
    function flushScroll() {
      const distance = currXRef.current - prevXRef.current
      if (distance) {
        model.horizontalScroll(-distance)
        prevXRef.current = currXRef.current
      }
    }

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      currXRef.current = event.clientX
      const distance = currXRef.current - prevXRef.current
      // use rAF to make it so multiple event handlers aren't fired per-frame
      // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
      if (distance && !scheduledRef.current) {
        scheduledRef.current = true
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null
          scheduledRef.current = false
          flushScroll()
        })
      }
    }

    function globalMouseUp() {
      // flush any movement still queued for the next frame before ending the
      // drag; otherwise a quick flick (mousedown/move/up within one frame) or
      // the cleanup below would cancel it and drop the scroll
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        scheduledRef.current = false
        flushScroll()
      }
      prevXRef.current = 0
      if (mouseDragging) {
        setMouseDragging(false)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      return () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
        // drop a frame queued mid-drag so it can't fire a stray scroll after
        // unmount (matches useWheelScroll's cleanup)
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
        scheduledRef.current = false
      }
    }
    return undefined
  }, [model, mouseDragging])

  function mouseDown(event: React.MouseEvent) {
    if (event.shiftKey) {
      return
    }
    // skip the click-drag pan when pressing an interactive control: a
    // draggable element, a resize handle, or a button (e.g. the menu button on
    // a highlight/bookmark chip, whose actual target is the icon inside it)
    const target = event.target as HTMLElement
    if (
      target.draggable ||
      target.dataset.resizer ||
      target.closest('button')
    ) {
      return
    }

    // otherwise do click and drag scroll
    if (event.button === 0) {
      prevXRef.current = event.clientX
      currXRef.current = event.clientX
      setMouseDragging(true)
    }
  }

  // this local mouseup is used in addition to the global because sometimes
  // the global add/remove are not called in time, resulting in issue #533
  function mouseUp(event: React.MouseEvent) {
    event.preventDefault()
    setMouseDragging(false)
  }
  return { mouseDown, mouseUp }
}
