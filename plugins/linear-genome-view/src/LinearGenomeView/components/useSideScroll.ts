import { useEffect, useRef } from 'react'

import type { LinearGenomeViewModel } from '../index.ts'
import type React from 'react'

// A press that travels further than this is a pan, and the click that ends it
// is not a click. A hand that wobbles two pixels can still select something.
const PAN_CLICK_THRESHOLD_PX = 4

// The pan publishes its state as attributes on the element the press landed in
// (TracksContainer), so a track's own pointer handlers read it with `closest`
// and nothing has to hand them a ref or a model field — the same marker shape
// as `data-gesture-owner`. `data-pan-dragging` is present from press to
// release; `data-pan-moved` is set once the press travels past the threshold
// and cleared by the next press, so it still answers for the click that
// follows the release.
const PAN_DRAGGING_ATTR = 'data-pan-dragging'
const PAN_MOVED_ATTR = 'data-pan-moved'

function preventDefault(event: Event) {
  event.preventDefault()
}

/**
 * Click-drag and touch-drag panning, on pointer events so a finger pans the
 * same as a mouse. The host sets `touch-action` to leave the browser only the
 * gestures the pan does not want (TracksContainer keeps vertical scroll and
 * page pinch); without it a touch drag is a page scroll and no pointer stream
 * arrives.
 *
 * The window listeners go on in the press handler itself rather than in an
 * effect, so a release that lands before React commits still finds them.
 */
export function useSideScroll(model: LinearGenomeViewModel) {
  const endPanRef = useRef<(() => void) | undefined>(undefined)

  useEffect(
    () => () => {
      endPanRef.current?.()
    },
    [],
  )

  function pointerDown(event: React.PointerEvent) {
    const host = event.currentTarget
    // Cleared for EVERY press, ahead of the returns below: the marker outlives
    // the gesture that set it, and a stale true is what the next reader of
    // this DOM contract would inherit.
    host.removeAttribute(PAN_MOVED_ATTR)
    if (
      event.shiftKey ||
      event.button !== 0 ||
      !event.isPrimary ||
      endPanRef.current
    ) {
      return
    }
    // a draggable element, a control that claimed the press (resize handles,
    // the scalebar, a legend), or a button: `closest`, since the press usually
    // lands on a child of the control
    const target = event.target as HTMLElement
    if (
      target.draggable ||
      target.closest('[data-gesture-owner]') ||
      target.closest('button')
    ) {
      return
    }

    const { pointerId } = event
    const startX = event.clientX
    let prevX = startX
    let currX = startX
    let frame: number | undefined

    function flush() {
      frame = undefined
      const distance = currX - prevX
      if (distance) {
        model.horizontalScroll(-distance)
        prevX = currX
      }
    }

    function move(e: PointerEvent) {
      if (e.pointerId !== pointerId) {
        return
      }
      currX = e.clientX
      if (Math.abs(currX - startX) > PAN_CLICK_THRESHOLD_PX) {
        host.setAttribute(PAN_MOVED_ATTR, '')
      }
      if (currX !== prevX && frame === undefined) {
        frame = window.requestAnimationFrame(flush)
      }
    }

    // A release applies the movement still queued for the next frame, so a
    // flick that starts and ends within one frame still pans. Unmount drops it
    // instead, so no stray scroll lands on a view that is going away.
    function end(applyQueued: boolean) {
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
        if (applyQueued) {
          flush()
        }
      }
      host.removeAttribute(PAN_DRAGGING_ATTR)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointercancel', release, true)
      window.removeEventListener('selectstart', preventDefault, true)
      endPanRef.current = undefined
    }

    // pointercancel as well as pointerup: the browser cancels a touch it takes
    // over as a vertical scroll, and the pan would otherwise stay latched
    function release(e: PointerEvent) {
      if (e.pointerId === pointerId) {
        end(true)
      }
    }

    host.setAttribute(PAN_DRAGGING_ATTR, '')
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', release, true)
    window.addEventListener('pointercancel', release, true)
    window.addEventListener('selectstart', preventDefault, true)
    endPanRef.current = () => {
      end(false)
    }
  }

  return { pointerDown }
}
