// Navigation gestures for a linear view, as two hooks a host can bind to an
// element it owns.
//
// This is the wiring between a pointing device and `zoomTo`/`horizontalScroll`,
// and it is the part of embedding a view that has no interesting variants: a
// wheel means the same thing in every genome browser, and getting it wrong is
// mostly invisible until a trackpad or a touchscreen is involved. JBrowse's own
// LinearGenomeView binds `useScrollZoomHint` to its tracks area, and an embedder
// building their own chrome around a view binds `usePanZoom` to theirs — same
// gestures, same feel, one implementation.
//
// Bind these to the data, not to the whole view. The chrome you leave out is
// the only surface a scroll-to-zoom user has left for scrolling the page: no
// modifier can serve as one, because browsers turn shift+wheel into horizontal
// scroll, ctrl/meta+wheel is how a trackpad reports a pinch, and Firefox binds
// alt+wheel to history navigation.
//
// The wheel half is `createWheelZoomController` (wheelZoom.ts), which is where
// the gesture decision matrix, the rAF batching and the zoom rate limit live.
// The scroll-to-zoom prompt every one of these raises is `useScrollZoomHint`,
// below the two gesture hooks.

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
 * `onModifierNeeded` is the controller's `onUnhandled` — the user wheeled
 * expecting a zoom and got nothing, because scroll-to-zoom is off and no
 * modifier was held. That mode's well-known failure is that it is
 * undiscoverable, and this is the hook for the prompt that fixes it
 * (`useScrollZoomHint` builds one on top). Nothing else can see the moment:
 * doing nothing leaves no trace on the view. It is handed the event because a
 * prompt worth showing is shown where the user is looking, and the wheel is the
 * only thing that knows where that is.
 */
export function useWheelZoom(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
  onModifierNeeded?: (event: WheelEvent) => void,
) {
  // stable, so a host passing an inline closure doesn't rebind the listener
  // every render
  const notify = useEventCallback((event: WheelEvent) => {
    onModifierNeeded?.(event)
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
          onUnhandled: notify,
        })
      : undefined
  }, [ref, view, notify])
}

// How far the pointer has to travel before a press counts as a pan rather than
// a click. Under this, the gesture is still a click and whatever is underneath
// gets to keep it.
const DRAG_THRESHOLD_PX = 4

// How long the prompt stays raised after the last dead wheel. Long enough to
// read four words, short enough to be gone before the next gesture. A prompt
// that carries a control rather than a caption wants longer, and passes its own
// — see `lingerMs`.
const HINT_LINGER_MS = 1200

// The longest the prompt may stay up no matter what, counted from the raise and
// not restarted by anything. Everything else that keeps it alive — wheeling on,
// the pointer resting on it — is a signal that can get stuck on: a pointer that
// entered and never left, a tab switched away mid-gesture. This is the one timer
// with no way to hold it off, so a prompt nobody is interacting with always goes
// away on its own.
const HINT_MAX_MS = 15000

/**
 * Marks the prompt's own element, so the press-anywhere-to-dismiss listener can
 * tell a press aimed at its button from a press aimed at the app. An attribute
 * rather than a ref because the state hook doesn't render the prompt — the host
 * does, and there are two of them (core's card, an embedder's caption).
 */
export const SCROLL_ZOOM_HINT_ATTR = 'data-scroll-zoom-hint'

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
 * The signal is the controller's `onUnhandled`: a vertical wheel over the view,
 * scroll-to-zoom off, no modifier, and nothing inside the view having already
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
 * Going away is the other half of it, and is not left to the linger timer alone:
 * escape, a press anywhere else, a ctrl+wheel (they took the advice), a tab
 * switch, and finally HINT_MAX_MS, which nothing can hold off. The prompt is an
 * interruption the user did not ask for, so every reading of "done with it"
 * counts, and none of them can be the only one — the pointer hold in particular
 * is released by a `mouseleave` that a backgrounded tab never dispatches.
 *
 * Of those, escape is the one that also says something about the *next* raise,
 * and is reported as `onAnswered` for the caller's budget to act on. The rest
 * are silence: a timer ran out, a tab went away, a press landed on whatever the
 * user was reaching for. Only silence should be answered by asking again.
 *
 * How often it may fire is the caller's to decide, through `enabled`/`onShow`.
 * That policy is deliberately not here: the budget worth enforcing is
 * session-wide (JBrowse spends one across every view — see the session's
 * `canShowScrollZoomHint`), and this hook is duck-typed on the view, like the
 * rest of the wheel-zoom layer, so it can't see a session and shouldn't learn
 * to.
 *
 * This is the state machine on its own, for a caller that binds the wheel some
 * other way — the synteny ribbon band drives one controller across a whole
 * stack of views, so it hands `noteDeadWheel` to `createWheelZoomController`'s
 * `onUnhandled` directly. A caller with a plain element and one view wants
 * `useScrollZoomHint` below, which binds the gestures too.
 */
export function useScrollZoomHintState({
  lingerMs = HINT_LINGER_MS,
  enabled = true,
  onShow,
  onAnswered,
}: {
  lingerMs?: number
  /** false to stop raising it at all — a spent budget, usually */
  enabled?: boolean
  /** one raise, for the caller to charge against whatever budget it keeps */
  onShow?: () => void
  /**
   * The user replied to the prompt rather than letting it time out: escape, or
   * a press somewhere else. A budget is for someone who might not have noticed
   * it, and this is the caller's signal that they did — see `dismissZoomHint`,
   * which reports the host's own reply (its button) the same way.
   */
  onAnswered?: () => void
} = {}) {
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
  // the backstop behind both of those — see HINT_MAX_MS
  const maxTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // suppresses the linger timer while the pointer rests on the prompt, so it
  // can't vanish from under a click
  const held = useRef(false)

  // One passive stamp on the document, in capture phase: it sees a scroll on any
  // ancestor, however deeply nested the scroller is and whichever one the
  // browser chained to. Capture because scroll events on an element don't
  // bubble, and passive because this only reads the clock.
  useEffect(() => {
    const onScroll = () => {
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

  // Every way the prompt goes down runs through here — the linger expiring, the
  // backstop, escape, the host's own button. One exit path, so none of them can
  // leave a timer or the hold behind for the next raise to trip over.
  //
  // Whether the user *answered* is the caller's business rather than this
  // hook's, and is a second function rather than a flag on this one — every
  // caller here is an event listener or a timer, both of which hand their own
  // first argument to whatever they were given.
  function dismiss() {
    clearTimeout(lingerTimer.current)
    clearTimeout(maxTimer.current)
    // a verdict still settling would raise the prompt again a moment after it
    // was dismissed, which reads as the dismissal not having worked
    clearTimeout(settleTimer.current)
    shown.current = false
    // the prompt unmounts under the pointer that was holding it open, so its
    // `mouseleave` never arrives — release the hold here or it stays latched
    // and the next prompt can't be kept up by wheeling on
    held.current = false
    setShow(false)
  }

  // ...and the same, for a user who replied to it rather than let it lapse
  function dismissAnswered() {
    dismiss()
    onAnswered?.()
  }

  function restartLinger() {
    clearTimeout(lingerTimer.current)
    lingerTimer.current = setTimeout(dismiss, lingerMs)
  }

  // the wheel has gone quiet: if nothing scrolled around the time of the last
  // one, that wheel was dead, and this is what the prompt is for
  function takeVerdict() {
    if (
      !enabled ||
      lastScrollAt.current > lastWheelAt.current - SCROLL_LAG_MS
    ) {
      return
    }
    shown.current = true
    setAt(cursor.current)
    setMounted(true)
    setShow(true)
    restartLinger()
    maxTimer.current = setTimeout(dismiss, HINT_MAX_MS)
    onShow?.()
  }

  function noteDeadWheel(event: WheelEvent) {
    cursor.current = { x: event.clientX, y: event.clientY }
    lastWheelAt.current = performance.now()
    if (shown.current) {
      // still trying — keep it up rather than letting it expire mid-gesture.
      // Not charged again: one raise is one interruption however long the user
      // keeps pushing.
      if (!held.current) {
        restartLinger()
      }
      return
    }
    if (!enabled) {
      return
    }
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(takeVerdict, SETTLE_MS)
  }

  // stable, so the listeners below bind once per raise rather than every render
  const dismissNow = useEventCallback(dismiss)
  const answerNow = useEventCallback(dismissAnswered)

  // While it is up, take it down at the first sign the user is done with it.
  // Bound only while `show`, so a view that has never hinted binds nothing.
  //
  // The timers are not enough on their own. Each of these is a moment the
  // prompt has outlived and no timer can see: the pointer holding it open never
  // fires its `mouseleave` (the tab was switched away, or the card was drawn
  // under a cursor that then stopped moving), or the user has simply moved on
  // and wants it gone now rather than in a few seconds.
  useEffect(() => {
    if (!show) {
      return
    }
    const onKeyDown = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        // waved away: an answer, and the plainest one there is
        answerNow()
      }
    }
    const onPointerDown = (event: Event) => {
      // a press on the prompt itself is aimed at its button — dismissing here
      // would unmount it before the click landed
      if (
        !(
          event.target instanceof Element &&
          // No `CSS.escape`: jsdom has no `CSS` at all, so the escape this rule
          // autofixes to is a ReferenceError in every test that presses while
          // the prompt is up. The interpolated value is the fixed module
          // constant above, not user input.
          // eslint-disable-next-line unicorn/require-css-escape
          event.target.closest(`[${SCROLL_ZOOM_HINT_ATTR}]`)
        )
      ) {
        // Not an answer, deliberately. Escape is aimed at the prompt; a press
        // is aimed at whatever is under it — a feature, a menu, the next thing
        // the user was doing — and reads as "not now" rather than "never".
        dismissNow()
      }
    }
    const onWheel = (event: Event) => {
      // they did the thing it asked for, so it has nothing left to say and no
      // business sitting over the zoom it just taught
      if (event instanceof WheelEvent && (event.ctrlKey || event.metaKey)) {
        dismissNow()
      }
    }
    // `visibilitychange` and `blur` both dismiss outright in either direction:
    // a backgrounded tab is how the pointer hold gets stuck for good (the
    // `mouseleave` is never dispatched), and a prompt nobody was there to read
    // has no second showing coming to it.
    const bindings: [EventTarget, string, EventListener][] = [
      [document, 'keydown', onKeyDown],
      [document, 'pointerdown', onPointerDown],
      [document, 'wheel', onWheel],
      [document, 'visibilitychange', dismissNow],
      [window, 'blur', dismissNow],
    ]
    // capture, so a handler inside the app that stops propagation can't hide a
    // dismissal from us; passive, since none of these preventDefault. Shared by
    // both loops — a remove whose options disagree leaves the listener bound.
    const opts = { capture: true, passive: true }
    for (const [target, type, handler] of bindings) {
      target.addEventListener(type, handler, opts)
    }
    return () => {
      for (const [target, type, handler] of bindings) {
        target.removeEventListener(type, handler, opts)
      }
    }
  }, [show, dismissNow, answerNow])

  useEffect(() => {
    return () => {
      clearTimeout(lingerTimer.current)
      clearTimeout(settleTimer.current)
      clearTimeout(maxTimer.current)
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
    /**
     * Take it down because the user acted on it — the host's own button. Counts
     * as an answer (`onAnswered`); the timers and the tab-switch path do not.
     */
    dismissZoomHint: dismissAnswered,
    /**
     * Hold the prompt open while the pointer is on it, and start it expiring
     * again on the way out.
     *
     * Take the hold on a pointer that *moved* onto the prompt, not on a plain
     * `mouseenter` — see ScrollZoomHint. Either way the hold is not the last
     * word: HINT_MAX_MS and the dismissals above outrank it, because a hold is
     * released by an event that doesn't always arrive.
     */
    setZoomHintHeld: (value: boolean) => {
      if (!shown.current) {
        // A hold taken while it isn't up would never be released: the card is
        // still in the DOM through its fade-out and can be moved over there,
        // and nothing is running to time it out. It would then suppress the
        // *next* raise's keep-alive instead of this one's.
        return
      }
      held.current = value
      if (value) {
        clearTimeout(lingerTimer.current)
      } else {
        restartLinger()
      }
    },
    /**
     * A wheel that did nothing, from whatever bound the gesture — the
     * controller's `onUnhandled`. Every gate above runs from here.
     */
    noteDeadWheel,
  }
}

/**
 * `useScrollZoomHintState` plus the gestures, for the usual case: one element,
 * one view. Binds what `useWheelZoom` binds — call this *or* that, never both.
 *
 * `usePanZoom` and JBrowse's own LinearGenomeView both come through here, so
 * the two prompts differ only in what they draw: a caption for the embedder, a
 * portalled card with the setting on it for the app.
 */
export function useScrollZoomHint(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
  opts: Parameters<typeof useScrollZoomHintState>[0] = {},
) {
  const hint = useScrollZoomHintState(opts)
  useWheelZoom(ref, view, hint.noteDeadWheel)
  return hint
}

/**
 * Every navigation gesture for a view, on one element: wheel zoom, side-scroll,
 * and click-drag panning.
 *
 * ```tsx
 * const ref = useWidthSetter(view)
 * const { containerProps, showZoomHint } = usePanZoom(ref, view)
 * return (
 *   <div ref={ref} {...containerProps}>
 *     …tracks…
 *   </div>
 * )
 * ```
 *
 * **`touch-action: none` comes with it**, written onto `ref`'s element. Without
 * it a browser claims a touch drag as a page scroll, the pointer stream never
 * arrives, and the gestures below are bound and dead — on a phone only, so a
 * demo written and tested on a desktop is inert with nothing in the console.
 * Asking the host for it was one line of documentation against a silent failure
 * on half the devices there are.
 *
 * Set imperatively rather than handed back as a style, because a host that
 * spreads its own `style` on the same element would drop it. React writes only
 * the style properties its own `style` prop names, so this survives every
 * render that does not mention `touchAction` — and a host that does name one
 * wins, which is the escape hatch. `touchAction` here is the other:
 * `'pan-y'` for a view inside a long document that should still scroll the
 * page vertically, or `false` to leave the property alone entirely.
 *
 * JBrowse's own view splits these across two elements (the wheel on the whole
 * view, the drag on the tracks area, so a drag over the header does nothing) and
 * so binds `useScrollZoomHint` plus its own `useSideScroll`. One element is the
 * normal case for an embedder, and this is it.
 */
export function usePanZoom(
  ref: React.RefObject<HTMLElement | null>,
  view: PanZoomView,
  {
    touchAction = 'none',
  }: {
    /** what to write as the element's `touch-action`, or false to write none */
    touchAction?: React.CSSProperties['touchAction'] | false
  } = {},
) {
  // `x` is the last position a pan was applied from; `panning` is whether the
  // press has travelled far enough to be a drag at all
  const dragRef = useRef<{ x: number; panning: boolean } | undefined>(undefined)
  // binds the wheel half, and reports the wheel that meant "zoom" and moved
  // nothing at all
  const { showZoomHint } = useScrollZoomHint(ref, view)

  // restores rather than clears on the way out: the element may outlive this
  // hook (a host that stops binding gestures without unmounting its container),
  // and clearing would take a `touch-action` the host set for itself
  useEffect(() => {
    const element = ref.current
    if (!element || touchAction === false) {
      return
    }
    // `|| ''` because a CSSOM that does not implement `touch-action` answers
    // `undefined` (jsdom does), and writing that back is a write of the string
    // "undefined" rather than a clear
    const previous = element.style.touchAction || ''
    element.style.touchAction = touchAction
    return () => {
      element.style.touchAction = previous
    }
  }, [ref, touchAction])

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
     * The user wheeled, scroll-to-zoom was off and no modifier was held, and
     * the page did not scroll either — so the gesture did nothing at all. Draw
     * a prompt saying what it would have taken; it clears itself. See
     * `useScrollZoomHint` for why the page-scrolled case is deliberately
     * excluded, and for the richer state a prompt with a control on it needs.
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
