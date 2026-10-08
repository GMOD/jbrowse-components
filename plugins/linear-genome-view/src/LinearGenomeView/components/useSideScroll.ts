import { useEffect, useRef } from 'react'

import { isClaimedPress } from '@jbrowse/core/util/pressOwner'
import { transaction } from 'mobx'

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
// or becomes a pinch, and cleared by the next press, so it still answers for
// the click that follows the release: `clickCapture` swallows that click
// before any track sees it.
const PAN_DRAGGING_ATTR = 'data-pan-dragging'
const PAN_MOVED_ATTR = 'data-pan-moved'

interface Point {
  x: number
  y: number
}

interface Gesture {
  join: (event: React.PointerEvent) => void
  cancel: () => void
}

function pointOf(event: { clientX: number; clientY: number }): Point {
  return { x: event.clientX, y: event.clientY }
}

/**
 * Drag to pan and pinch to zoom, on pointer events so a finger works the same
 * as a mouse. A second finger turns a pan into a pinch: the spread between the
 * two zooms about their midpoint, and moving the midpoint pans. Lifting either
 * finger goes back to panning with the other.
 *
 * The host sets `touch-action` to leave the browser only the gestures this
 * does not want (TracksContainer keeps vertical scroll); without it a touch
 * drag is a page scroll and a pinch zooms the page, and no pointer stream
 * arrives.
 *
 * The window listeners go on in the press handler itself rather than in an
 * effect, so a release that lands before React commits still finds them.
 */
export function useSideScroll(model: LinearGenomeViewModel) {
  const gestureRef = useRef<Gesture | undefined>(undefined)

  useEffect(
    () => () => {
      gestureRef.current?.cancel()
    },
    [],
  )

  function pointerDown(event: React.PointerEvent) {
    const host = event.currentTarget
    if (gestureRef.current) {
      gestureRef.current.join(event)
      return
    }
    // Cleared for EVERY press, ahead of the returns below: the marker outlives
    // the gesture that set it, and a stale true is what the next reader of
    // this DOM contract would inherit.
    host.removeAttribute(PAN_MOVED_ATTR)
    if (event.shiftKey || event.button !== 0 || !event.isPrimary) {
      return
    }
    if (isClaimedPress(event)) {
      return
    }

    const left = host.getBoundingClientRect().left
    const startX = event.clientX
    // where each finger is now, and where it was when the view last moved
    const pointers = new Map([[event.pointerId, pointOf(event)]])
    let applied = new Map(pointers)
    let frame: number | undefined

    // only a selection that starts in the tracks, so a press that leaks here
    // cannot block selection in the rest of the app
    function blockSelection(e: Event) {
      if (e.target instanceof Node && host.contains(e.target)) {
        e.preventDefault()
      }
    }

    function flush() {
      frame = undefined
      const [a, b] = [...pointers.keys()]
      const curr1 = pointers.get(a!)!
      const prev1 = applied.get(a!)!
      if (b === undefined) {
        if (curr1.x !== prev1.x) {
          model.horizontalScroll(prev1.x - curr1.x)
        }
      } else {
        const curr2 = pointers.get(b)!
        const prev2 = applied.get(b)!
        const prevSpread = Math.hypot(prev1.x - prev2.x, prev1.y - prev2.y)
        const spread = Math.hypot(curr1.x - curr2.x, curr1.y - curr2.y)
        const prevMid = (prev1.x + prev2.x) / 2
        const mid = (curr1.x + curr2.x) / 2
        transaction(() => {
          if (prevSpread > 0 && spread > 0) {
            model.zoomTo((model.bpPerPx * prevSpread) / spread, prevMid - left)
          }
          if (mid !== prevMid) {
            model.horizontalScroll(prevMid - mid)
          }
        })
      }
      applied = new Map(pointers)
    }

    // Applies what is queued before the set of fingers changes, so the next
    // frame measures from where every finger is now rather than jumping by the
    // distance between them.
    function settle() {
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
        flush()
      }
    }

    function move(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) {
        return
      }
      pointers.set(e.pointerId, pointOf(e))
      if (Math.abs(e.clientX - startX) > PAN_CLICK_THRESHOLD_PX) {
        host.setAttribute(PAN_MOVED_ATTR, '')
      }
      frame ??= window.requestAnimationFrame(flush)
    }

    function end(applyQueued: boolean) {
      if (applyQueued) {
        settle()
      } else if (frame !== undefined) {
        window.cancelAnimationFrame(frame)
      }
      host.removeAttribute(PAN_DRAGGING_ATTR)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', release, true)
      window.removeEventListener('pointercancel', release, true)
      window.removeEventListener('selectstart', blockSelection, true)
      gestureRef.current = undefined
    }

    // pointercancel as well as pointerup: the browser cancels a touch it takes
    // over as a vertical scroll, and the gesture would otherwise stay latched
    function release(e: PointerEvent) {
      if (!pointers.has(e.pointerId)) {
        return
      }
      if (pointers.size > 1) {
        settle()
        pointers.delete(e.pointerId)
        applied.delete(e.pointerId)
      } else {
        end(true)
      }
    }

    host.setAttribute(PAN_DRAGGING_ATTR, '')
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', release, true)
    window.addEventListener('pointercancel', release, true)
    window.addEventListener('selectstart', blockSelection, true)
    gestureRef.current = {
      join(e) {
        if (e.pointerType !== 'touch' || pointers.size > 1) {
          return
        }
        settle()
        pointers.set(e.pointerId, pointOf(e))
        applied = new Map(pointers)
        host.setAttribute(PAN_MOVED_ATTR, '')
        model.cancelZoomAnimation()
      },
      cancel() {
        end(false)
      },
    }
  }

  // The browser fires `click` after a release on whatever the press and the
  // release share, which over a track is its canvas, so a pan that ended on a
  // gene would open that gene's details.
  function clickCapture(event: React.MouseEvent) {
    if (event.currentTarget.hasAttribute(PAN_MOVED_ATTR)) {
      event.stopPropagation()
    }
  }

  return { pointerDown, clickCapture }
}
