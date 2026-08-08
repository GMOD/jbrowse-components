import { useEffect, useRef, useState } from 'react'

import { useWheelZoom } from '@jbrowse/core/util/usePanZoom'

import type { PanZoomView } from '@jbrowse/core/util/usePanZoom'
import type React from 'react'

// How long the prompt stays up after the last dead wheel. `usePanZoom`'s own
// hint is a caption and clears in 1200ms; this one carries a button, so it has
// to outlast the trip from "I read it" to "my cursor is on it".
const LINGER_MS = 5000

// Quiet needed after a wheel before its verdict is taken. Same idiom (and order
// of magnitude) as wheelZoom's ZOOM_ACTIVE_WINDOW_MS and scrollLatch's
// LATCH_TIMEOUT_MS: continuous trackpad or inertial scrolling fires every ~16ms,
// so this much silence means the user stopped pushing.
const SETTLE_MS = 150

// How long after a wheel its scroll may still arrive and count as caused by it.
// Bigger than it looks: measured in Chrome against jbrowse-web, a wheel at
// t=48.0ms had its animation frame at t=48.4ms and its *scroll event* only at
// t=65.1ms — a whole frame later. Anything that decides within one frame reads
// "nothing scrolled" for a gesture that scrolled perfectly well.
const SCROLL_LAG_MS = 100

/**
 * Binds the view's wheel gestures and, when a wheel plainly meant "zoom" and
 * did nothing, raises the prompt that says so — the discoverability half of
 * scroll-to-zoom being off by default.
 *
 * The signal is `useWheelZoom`'s `onModifierNeeded`: a vertical wheel over the
 * view, scroll-to-zoom off, no modifier, and nothing inside the view having
 * claimed the gesture. That is a statement of intent rather than a guess about
 * one, which is why the prompt can be gated on it instead of shown to everyone
 * on first visit — nobody who wasn't reaching for zoom ever sees it.
 *
 * Then gated a second time on whether the page actually scrolled. If it did,
 * nothing was lost and there is nothing to say — that is the case
 * scroll-to-zoom being off is *for*, and the prompt has no business arguing with
 * it. Only a wheel that moved nothing at all raises it.
 *
 * The gate is deliberately "did it scroll", not "could it scroll". They sound
 * interchangeable and are not: jbrowse-web's view container overflows its
 * viewport by a couple of hundred pixels with a *single* alignments track open,
 * so a can-it-scroll test is true on nearly every page and the prompt would
 * never appear. Did-it-scroll also lands the behavior in the right place on its
 * own — someone on a long page scrolls freely and sees nothing, and is offered
 * the zoom once scrolling has run out of page to give.
 *
 * And it is asked per wheel rather than per gesture, which matters for the exact
 * case this exists to catch: scrolling to the bottom of a view and continuing to
 * push is one unbroken run of wheel events, and judging the run as a whole lets
 * its scrolling first half acquit its dead second half.
 *
 * Replaces the bare `useWheelZoom` call on the view container — it binds the
 * same gestures, so don't call both.
 *
 * Takes the same duck-typed view as the rest of the wheel-zoom layer rather than
 * the LGV model: nothing here needs more than the gestures do, and the
 * `setScrollZoom` the prompt eventually calls belongs to the prompt.
 */
export function useScrollZoomHint(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
) {
  const [show, setShow] = useState(false)
  // Where the prompt is drawn: the viewport point of the gesture that earned
  // it. Not a decoration — this fires most often once the view has been
  // scrolled past, so anything anchored to the view itself is off-screen at the
  // one moment it is needed.
  const [at, setAt] = useState({ x: 0, y: 0 })
  // Latches on the first hint and stays on, so the prompt can fade *out*
  // instead of blinking away: `show` alone would unmount it the instant it
  // expires. A view that has never hinted renders (and downloads) nothing.
  const [mounted, setMounted] = useState(false)
  // Mirrors `show` for the wheel handler, which can't see a state update that
  // hasn't rendered yet — a wheel burst delivers dozens of events before React
  // commits once.
  const shown = useRef(false)
  const cursor = useRef({ x: 0, y: 0 })
  // Both off `performance.now()` at handling time, so directly comparable —
  // and not off `event.timeStamp`, which is the same thing in a browser but is
  // wall-clock in jsdom and so can't be driven by a test's clock. The gap
  // between an event and its handler is sub-millisecond either way, against a
  // window of SCROLL_LAG_MS.
  const lastWheelAt = useRef(0)
  const lastScrollAt = useRef(Number.NEGATIVE_INFINITY)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  // suppresses the linger timer while the pointer rests on the prompt, so it
  // can't vanish from under a click
  const held = useRef(false)

  // One passive stamp on the document, in capture phase: it sees a scroll on any
  // ancestor, however deeply nested the scroller is and whichever one the
  // browser chained to. Capture because scroll events on an element don't
  // bubble, and passive because this only reads the clock.
  useEffect(() => {
    const onScroll = (event: Event) => {
      lastScrollAt.current = performance.now()
    }
    document.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
    }
  }, [])

  function restartLinger() {
    clearTimeout(lingerTimer.current)
    lingerTimer.current = setTimeout(() => {
      shown.current = false
      setShow(false)
    }, LINGER_MS)
  }

  function dismiss() {
    clearTimeout(lingerTimer.current)
    shown.current = false
    setShow(false)
  }

  // the wheel has gone quiet: if nothing scrolled around the time of the last
  // one, that wheel was dead, and this is what the prompt is for
  function takeVerdict() {
    if (
      lastScrollAt.current > lastWheelAt.current - SCROLL_LAG_MS ||
      !ref.current
    ) {
      return
    }
    shown.current = true
    setAt(cursor.current)
    setMounted(true)
    setShow(true)
    restartLinger()
  }

  useWheelZoom(ref, view, event => {
    cursor.current = { x: event.clientX, y: event.clientY }
    lastWheelAt.current = performance.now()
    if (shown.current) {
      // still trying — keep it up rather than letting it expire mid-gesture
      if (!held.current) {
        restartLinger()
      }
      return
    }
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(takeVerdict, SETTLE_MS)
  })

  useEffect(() => {
    return () => {
      clearTimeout(lingerTimer.current)
      clearTimeout(settleTimer.current)
    }
  }, [])

  return {
    /**
     * The user wheeled expecting a zoom, scroll-to-zoom was off, and nothing
     * scrolled either — so the gesture did nothing at all. Draw the prompt; it
     * clears itself.
     */
    showZoomHint: show,
    /** viewport point to draw it at — see `at` */
    zoomHintAt: at,
    /** whether the prompt has ever been raised — see `mounted` */
    zoomHintMounted: mounted,
    dismissZoomHint: dismiss,
    /**
     * Hold the prompt open while the pointer is on it, and start it expiring
     * again on the way out.
     */
    setZoomHintHeld: (value: boolean) => {
      held.current = value
      if (value) {
        clearTimeout(lingerTimer.current)
      } else if (shown.current) {
        restartLinger()
      }
    },
  }
}
