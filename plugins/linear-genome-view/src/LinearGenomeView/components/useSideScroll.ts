import { useEffect, useRef, useState } from 'react'

import type { LinearGenomeViewModel } from '../index.ts'
import type React from 'react'

// A press that travels further than this is a pan, and the click that ends it
// is not a click. A hand that wobbles two pixels can still select something.
const PAN_CLICK_THRESHOLD_PX = 4

// The pan publishes its state as attributes on the element the press landed in
// (TracksContainer), so a track's own pointer handlers read it with `closest`
// and nothing has to hand them a ref or a model field — the same marker shape
// as `data-gesture-owner`. `data-pan-dragging` is present from mousedown to
// mouseup; `data-pan-moved` is set once the press travels past the threshold
// and cleared by the next press, so it still answers for the click that
// follows mouseup.
const PAN_DRAGGING_ATTR = 'data-pan-dragging'
const PAN_MOVED_ATTR = 'data-pan-moved'

export function useSideScroll(model: LinearGenomeViewModel) {
  const [mouseDragging, setMouseDragging] = useState(false)
  const scheduledRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  const startXRef = useRef(0)
  const prevXRef = useRef(0)
  const currXRef = useRef(0)
  const hostRef = useRef<Element | null>(null)

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
      if (
        Math.abs(currXRef.current - startXRef.current) > PAN_CLICK_THRESHOLD_PX
      ) {
        hostRef.current?.setAttribute(PAN_MOVED_ATTR, '')
      }
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
      hostRef.current?.removeAttribute(PAN_DRAGGING_ATTR)
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
        // unmount (matches `useVirtualScrollWheel`'s cleanup)
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
    // Cleared for EVERY press, ahead of the returns below, because the marker
    // outlives the gesture that set it: a pan, then a shift-press or a press on
    // a button, used to leave `data-pan-moved` standing on the container. The
    // one reader today re-enters through a press that reaches the bottom of
    // this function, so nothing was wrong — but these attributes are a DOM
    // contract other displays read with `closest`, and a stale true is what the
    // next reader would inherit.
    event.currentTarget.removeAttribute(PAN_MOVED_ATTR)
    if (event.shiftKey) {
      return
    }
    // skip the click-drag pan when pressing an interactive control: a
    // draggable element, a control that claimed the press (resize handles, the
    // scalebar), or a button (e.g. the menu button on a highlight/bookmark
    // chip, whose actual target is the icon inside it). All three are matched
    // with `closest`, since the press usually lands on a child of the control
    // rather than the control itself.
    const target = event.target as HTMLElement
    if (
      target.draggable ||
      target.closest('[data-gesture-owner]') ||
      target.closest('button')
    ) {
      return
    }

    // otherwise do click and drag scroll
    if (event.button === 0) {
      hostRef.current = event.currentTarget
      event.currentTarget.setAttribute(PAN_DRAGGING_ATTR, '')
      startXRef.current = event.clientX
      prevXRef.current = event.clientX
      currXRef.current = event.clientX
      setMouseDragging(true)
    }
  }

  // this local mouseup is used in addition to the global because sometimes
  // the global add/remove are not called in time, resulting in issue #533
  function mouseUp(event: React.MouseEvent) {
    event.preventDefault()
    hostRef.current?.removeAttribute(PAN_DRAGGING_ATTR)
    setMouseDragging(false)
  }
  return { mouseDown, mouseUp }
}
