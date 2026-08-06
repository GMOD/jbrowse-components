// Navigation gestures for a linear view, as two hooks a host can bind to an
// element it owns.
//
// This is the wiring between a pointing device and `zoomTo`/`horizontalScroll`,
// and it is the part of embedding a view that has no interesting variants: a
// wheel means the same thing in every genome browser, and getting it wrong is
// mostly invisible until a trackpad or a touchscreen is involved. JBrowse's own
// LinearGenomeView binds `useWheelZoom` to its container, and an embedder
// building their own chrome around a view binds `usePanZoom` to theirs — same
// gestures, same feel, one implementation.
//
// The wheel half is `createWheelZoomController` (wheelZoom.ts), which is where
// the gesture decision matrix, the rAF batching and the zoom rate limit live.

import { useEffect, useRef, useState } from 'react'

import { useEventCallback } from './useEventCallback.ts'
import { createWheelZoomController } from './wheelZoom.ts'

import type { WheelZoomView } from './wheelZoom.ts'
import type React from 'react'

/**
 * What the gestures need off a view: `bpPerPx`/`zoomTo`/`horizontalScroll` from
 * WheelZoomView, plus the scroll-to-zoom preference.
 *
 * Duck-typed rather than taking a model, like the rest of the wheel-zoom layer.
 *
 * **`scrollZoom` belongs to the view, not to a piece of React state of your
 * own.** Displays that scroll vertically inside themselves — an alignments
 * pileup is the one you hit first — consult the same flag to decide whether the
 * plain wheel is already spoken for, so a private copy that disagrees gets you
 * both at once: the pileup scrolls its reads *and* the view zooms under the
 * cursor. It is read at event time, so flipping it takes effect on the next
 * wheel event with nothing rebound.
 */
export interface PanZoomView extends WheelZoomView {
  scrollZoom?: boolean
}

/**
 * Wheel zoom and side-scroll, bound to `ref` for as long as the component
 * lives.
 *
 * The listener is registered on the element directly and non-passively, which
 * is not a style preference: React registers `wheel` at the root as a *passive*
 * listener, so a handler installed through the `onWheel` prop cannot
 * `preventDefault`, and the gesture would drive the page out from under you at
 * the same time as it drove the view.
 *
 * `onModifierNeeded` fires when the user wheeled expecting a zoom and got
 * nothing — scroll-to-zoom off, no ctrl/meta held, a vertical gesture. That
 * mode's well-known failure is that it is undiscoverable, and this is the hook
 * for the prompt that fixes it (`usePanZoom` builds one on top). Nothing else
 * can see the moment: doing nothing leaves no trace on the view.
 */
export function useWheelZoom(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
  onModifierNeeded?: () => void,
) {
  // stable, so a host passing an inline closure doesn't rebind the listener
  // every render
  const notify = useEventCallback(() => {
    onModifierNeeded?.()
  })
  useEffect(() => {
    const element = ref.current
    return element
      ? createWheelZoomController({
          element,
          // the view fills its own area and doesn't move under the cursor, so a
          // mouseleave here really means the gesture belongs to the page now
          releaseOnPointerLeave: true,
          resolveTarget: () => ({
            views: [view],
            scrollZoom: !!view.scrollZoom,
            originElement: () => element,
          }),
          onEvent: event => {
            if (
              !view.scrollZoom &&
              !event.ctrlKey &&
              !event.metaKey &&
              Math.abs(event.deltaY) > Math.abs(event.deltaX)
            ) {
              notify()
            }
          },
        })
      : undefined
  }, [ref, view, notify])
}

// How far the pointer has to travel before a press counts as a pan rather than
// a click. Under this, the gesture is still a click and whatever is underneath
// gets to keep it.
const DRAG_THRESHOLD_PX = 4

// How long `showZoomHint` stays raised after the last wheel event. Long enough
// to read four words, short enough to be gone before the next gesture.
const HINT_LINGER_MS = 1200

/**
 * Every navigation gesture for a view, on one element: wheel zoom, side-scroll,
 * and click-drag panning.
 *
 * ```tsx
 * const ref = useWidthSetter(view)
 * const { containerProps, showZoomHint } = usePanZoom(ref, view)
 * return (
 *   <div ref={ref} {...containerProps} style={{ touchAction: 'none' }}>
 *     …tracks…
 *   </div>
 * )
 * ```
 *
 * `touchAction: 'none'` is the host's half of the deal — without it the browser
 * claims a touch-drag as a page scroll and the pointer stream never arrives.
 *
 * JBrowse's own view splits these across two elements (the wheel on the whole
 * view, the drag on the tracks area, so a drag over the header does nothing) and
 * so binds `useWheelZoom` plus its own `useSideScroll`. One element is the
 * normal case for an embedder, and this is it.
 */
export function usePanZoom(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
) {
  // `x` is the last position a pan was applied from; `panning` is whether the
  // press has travelled far enough to be a drag at all
  const dragRef = useRef<{ x: number; panning: boolean } | undefined>(undefined)
  const [showZoomHint, setShowZoomHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useWheelZoom(ref, view, () => {
    setShowZoomHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => {
      setShowZoomHint(false)
    }, HINT_LINGER_MS)
  })

  useEffect(() => {
    return () => {
      clearTimeout(hintTimer.current)
    }
  }, [])

  function endDrag(event: React.PointerEvent<HTMLElement>) {
    dragRef.current = undefined
    // release only what the move handler took — a press that stayed under the
    // threshold never captured anything
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    /**
     * The user wheeled, scroll-to-zoom was off and no modifier was held, so the
     * page scrolled and the view did not move. Draw a prompt saying what it
     * would have taken; it clears itself.
     */
    showZoomHint,
    containerProps: {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        // Leave the press alone when something else owns it: a control that
        // claimed it (`[data-gesture-owner]`, JBrowse's marker on the parts
        // that drag on their own — a display's vertical scrollbar, a resize
        // handle), a button (the track-sizing button a display draws in its own
        // corner), or a draggable element. `closest`, because the press usually
        // lands on an icon inside the control. Shift is left alone too: it is
        // what a range-select of the host's own would want, and it is what
        // JBrowse's own view uses it for.
        if (event.button !== 0 || event.shiftKey) {
          return
        }
        if (
          event.target instanceof Element &&
          event.target.closest(
            'button, [data-gesture-owner], [draggable="true"]',
          )
        ) {
          return
        }
        // Note what this does *not* do: capture the pointer. See onPointerMove.
        dragRef.current = { x: event.clientX, panning: false }
      },
      onPointerMove(event: React.PointerEvent<HTMLElement>) {
        const drag = dragRef.current
        if (!drag) {
          return
        }
        if (!drag.panning) {
          if (Math.abs(event.clientX - drag.x) < DRAG_THRESHOLD_PX) {
            return
          }
          // Past the threshold this is a pan, so take the pointer: the gesture
          // has to keep panning when the cursor leaves the element, and end
          // even if it is released outside the window.
          //
          // Capturing is deferred to here because it retargets the whole rest
          // of the gesture — including the `click` that ends it — at this
          // element. Capture on pointerdown instead and every click inside the
          // view lands here, so nothing underneath ever sees one: a display's
          // click-to-select-a-feature stops selecting. A press that never moves
          // never captures, and stays the click it looks like.
          drag.panning = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        view.horizontalScroll(drag.x - event.clientX)
        drag.x = event.clientX
      },
      // pointercancel as well as pointerup: a touch drag interrupted by the
      // browser never fires `up`, and the drag would stay latched
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}
