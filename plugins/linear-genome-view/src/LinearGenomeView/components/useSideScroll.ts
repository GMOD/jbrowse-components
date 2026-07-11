import type React from 'react'
import { useEffect, useRef, useState } from 'react'

import type { LinearGenomeViewModel } from '../index.ts'

export function useSideScroll(model: LinearGenomeViewModel) {
  const [mouseDragging, setMouseDragging] = useState(false)
  // refs are to store these variables to avoid repeated rerenders associated
  // with useState/setState
  const scheduledRef = useRef(false)

  const prevXRef = useRef(0)

  useEffect(() => {
    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const currX = event.clientX
      const distance = currX - prevXRef.current
      // use rAF to make it so multiple event handlers aren't fired per-frame
      // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
      if (distance && !scheduledRef.current) {
        scheduledRef.current = true
        window.requestAnimationFrame(() => {
          model.horizontalScroll(-distance)
          scheduledRef.current = false
          prevXRef.current = currX
        })
      }
    }

    function globalMouseUp() {
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
