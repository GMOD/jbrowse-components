import type React from 'react'
import { useRef, useEffect, useState } from 'react'

// locals
import type { LinearGenomeViewModel } from '..'

export function useSideScroll(model: LinearGenomeViewModel) {
  const [mouseDragging, setMouseDragging] = useState(false)
  // refs are to store these variables to avoid repeated rerenders associated
  // with useState/setState
  const scheduled = useRef(false)

  const prevX = useRef<number>(0)

  useEffect(() => {
    let cleanup = () => {}

    function globalMouseMove(event: MouseEvent) {
      event.preventDefault()
      const currX = event.clientX
      const distance = currX - prevX.current
      if (distance) {
        // use rAF to make it so multiple event handlers aren't fired per-frame
        // see https://calendar.perfplanet.com/2013/the-runtime-performance-checklist/
        if (!scheduled.current) {
          scheduled.current = true
          window.requestAnimationFrame(() => {
            model.horizontalScroll(-distance)
            scheduled.current = false
            prevX.current = event.clientX
          })
        }
      }
    }

    function globalMouseUp() {
      prevX.current = 0
      if (mouseDragging) {
        setMouseDragging(false)
      }
    }

    if (mouseDragging) {
      window.addEventListener('mousemove', globalMouseMove, true)
      window.addEventListener('mouseup', globalMouseUp, true)
      cleanup = () => {
        window.removeEventListener('mousemove', globalMouseMove, true)
        window.removeEventListener('mouseup', globalMouseUp, true)
      }
    }
    return cleanup
  }, [model, mouseDragging])

  function mouseDown(event: React.MouseEvent) {
    if (event.shiftKey) {
      return
    }
    // check if clicking a draggable element or a resize handle
    const target = event.target as HTMLElement
    if (target.draggable || target.dataset.resizer) {
      return
    }

    // otherwise do click and drag scroll
    if (event.button === 0) {
      prevX.current = event.clientX
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
