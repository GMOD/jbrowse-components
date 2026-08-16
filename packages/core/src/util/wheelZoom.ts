// Shared wheel-zoom math and event handling for linear genome views. The LGV
// wheel handler, the breakpoint-split overlay and the synteny canvas all zoom on
// ctrl/scroll-zoom wheel gestures and must behave identically, so the normalizer,
// the rate limit and the whole gesture decision matrix live here —
// createWheelZoomController below is what each of those three actually runs.

import { transaction } from 'mobx'

import { createFrameCoalescer } from './frameCoalescer.ts'
import { trackPointerPresence } from './pointerPresence.ts'

// max zoom delta per millisecond — equivalent to 0.2 per frame at 60fps
export const MAX_ZOOM_RATE_PER_MS = 0.2 / 16.67

// Scroll-zoom (plain wheel with the scrollZoom preference on) divides by a fixed
// amount for a smooth proportional feel, rather than the adaptive
// getZoomNormalizer used for ctrl/pinch zoom where device deltas vary wildly.
export const SCROLL_ZOOM_FACTOR_DIVISOR = 500

// The per-event contribution to the zoom accumulator, given a wheel delta
// already normalized to pixels via normalizeWheelDelta. ctrl/pinch zoom uses the
// adaptive normalizer; scroll-zoom uses the fixed divisor. Single source of the
// zoom-step feel so every wheel handler (LGV, breakpoint overlay, synteny)
// zooms identically for the same gesture.
export function wheelZoomAccum(normalizedDeltaY: number, isCtrlZoom: boolean) {
  return (
    normalizedDeltaY /
    (isCtrlZoom
      ? getZoomNormalizer(normalizedDeltaY)
      : SCROLL_ZOOM_FACTOR_DIVISOR)
  )
}

// larger wheel deltas (e.g. mouse wheel notches) divide by more so a single
// notch produces a consistent zoom step regardless of device delta magnitude
export function getZoomNormalizer(deltaY: number) {
  const abs = Math.abs(deltaY)
  if (abs < 6) {
    return 25
  }
  if (abs > 150) {
    return 500
  }
  if (abs > 30) {
    return 150
  }
  return 75
}

// One wheel notch in line mode (deltaMode 1) is roughly this many pixels, and a
// page (deltaMode 2) roughly WHEEL_PAGE_HEIGHT — the values Facebook's
// normalize-wheel uses, the de-facto cross-browser convention. Pixel mode (0),
// which trackpads and modern mice report, passes through untouched.
const WHEEL_LINE_HEIGHT = 40
const WHEEL_PAGE_HEIGHT = 800

// Convert a WheelEvent delta from its deltaMode units to pixels. Panel-scroll
// callers pass the viewport height as `pageHeight` so a page maps to exactly one
// screen; the zoom path omits it and takes the default. Single normalizer for
// both the zoom math here and the vertical-scroll handlers so a notch means the
// same thing everywhere.
export function normalizeWheelDelta(
  delta: number,
  deltaMode: number,
  pageHeight = WHEEL_PAGE_HEIGHT,
) {
  return deltaMode === 1
    ? delta * WHEEL_LINE_HEIGHT
    : deltaMode === 2
      ? delta * pageHeight
      : delta
}

// elapsed since the previous animation frame, clamped to 100ms and defaulting
// to one 60fps frame when there is no prior frame (first event or post-resume)
export function wheelFrameElapsedMs(now: number, lastRafTime: number | null) {
  return Math.min(100, lastRafTime !== null ? now - lastRafTime : 16.67)
}

// Accumulate horizontal scroll across a frame, restarting from zero when the
// gesture reverses direction so a flick the opposite way isn't cancelled out by
// leftover momentum.
export function accumulateScroll(prev: number, deltaX: number) {
  const reversed = prev !== 0 && Math.sign(deltaX) !== Math.sign(prev)
  return (reversed ? 0 : prev) + deltaX
}

// A pinch/scroll-zoom gesture fires a continuous stream of wheel events, so we
// treat the view as "actively zooming" until this many ms pass with no zoom
// event. While actively zooming, callers ignore horizontal deltas: trackpads
// emit an unintentional side-scroll mid-gesture that would otherwise pan the
// view out from under the user.
export const ZOOM_ACTIVE_WINDOW_MS = 100

// `now` and `lastZoomTime` are both wheel-event timeStamps (same clock).
// lastZoomTime is null before any zoom has occurred.
export function isActivelyZooming(now: number, lastZoomTime: number | null) {
  return lastZoomTime !== null && now - lastZoomTime < ZOOM_ACTIVE_WINDOW_MS
}

// apply an accumulated zoom amount to bpPerPx, rate-limited so a burst of wheel
// events can't zoom faster than MAX_ZOOM_RATE_PER_MS over the frame's elapsed
export function applyZoomAccum(
  bpPerPx: number,
  zoomAccum: number,
  elapsedMs: number,
) {
  const max = MAX_ZOOM_RATE_PER_MS * elapsedMs
  const d = Math.max(-max, Math.min(max, zoomAccum))
  return d > 0 ? bpPerPx * (1 + d) : bpPerPx / (1 - d)
}

export interface WheelZoomView {
  bpPerPx: number
  zoomTo: (bpPerPx: number, offset?: number) => void
  horizontalScroll: (delta: number) => void
}

export interface WheelZoomTarget {
  // every view the gesture drives, each zoomed about the same cursor pixel — one
  // entry for a plain LGV, all stacked views for the synteny canvas
  views: WheelZoomView[]
  scrollZoom: boolean
  // The element the cursor pixel is measured from. Resolved inside the rAF, not
  // in the wheel handler: getBoundingClientRect() there forces a synchronous
  // reflow on every event of a burst and trips "[Violation] 'wheel' handler took
  // Nms". event.offsetX would be simpler but is unreliable, since wheel events
  // bubble up from child elements.
  originElement: () => HTMLElement | undefined
}

export interface WheelZoomControllerOptions {
  element: HTMLElement
  // Which views this event drives, or undefined to ignore the event entirely
  // (and leave it to the page). Called per event, so it must not read layout.
  resolveTarget: (event: WheelEvent) => WheelZoomTarget | undefined
  // preventDefault even on a gesture we take no action on, so the page can never
  // scroll out from under this element
  swallowUnhandled?: boolean
  /**
   * Abandon the gesture once the pointer leaves `element`, rather than following
   * the wheel events the browser keeps latching here (see trackPointerPresence).
   *
   * Only for an element large and stationary enough that "the pointer left" is a
   * real exit. On a small or moving target it isn't: a zoom slides a thin svg
   * ribbon out from under a stationary cursor, the browser fires mouseleave, and
   * the gesture would die halfway through. So this is opt-in, not the default.
   */
  releaseOnPointerLeave?: boolean
  // observe every event this element receives, before any gate
  onEvent?: (event: WheelEvent) => void
  /**
   * A wheel that meant "zoom" and got nothing: vertical, no ctrl/meta,
   * scroll-to-zoom off, and nothing nested inside having already claimed it.
   * The gesture leaves no trace on any view, so this callback is the only way
   * to see it happened — which is what the scroll-to-zoom prompt is built on
   * (`useScrollZoomHint`).
   *
   * Fires from inside the target branch, so a gesture the controller released
   * (`releaseOnPointerLeave`, or a `resolveTarget` that declined) is not
   * reported: the view did nothing because it was not being asked, which is a
   * different thing from doing nothing when it was.
   *
   * It does *not* say the page scrolled instead. With `swallowUnhandled` it
   * certainly didn't, and without it that is up to the browser — a caller that
   * cares has to watch for the scroll itself.
   */
  onUnhandled?: (event: WheelEvent) => void
}

interface WheelState {
  scrollDelta: number
  zoomAccum: number
  target: WheelZoomTarget | undefined
  lastClientX: number
  // the previous frame's stamp, which the zoom rate limit measures elapsed
  // against. The frame itself belongs to the coalescer, not to this state.
  lastRafTime: number | null
  lastZoomTime: number | null
  lastEventTime: number | null
  warnedNonCancelable: boolean
}

/**
 * The one wheel gesture handler for linear views. Its decision matrix:
 *
 *   - ctrl/meta+wheel, or (scrollZoom && |dy| >= |dx|)  → zoom about the cursor
 *   - shift+wheel while scrollZoom is on                → native scroll, we pass
 *   - a horizontal delta, unless one arrives mid-zoom   → pan by dx
 *
 * The listener is non-passive so it can preventDefault to suppress native scroll
 * during a zoom. To pay for that it only accumulates deltas: every model write
 * happens in one requestAnimationFrame, so a burst of events (fast trackpad,
 * inertial scroll) collapses to a single update per frame instead of thrashing
 * the views once per event.
 *
 * Returns its disposer.
 */
export function createWheelZoomController({
  element,
  resolveTarget,
  swallowUnhandled = false,
  releaseOnPointerLeave = false,
  onEvent,
  onUnhandled,
}: WheelZoomControllerOptions) {
  const frame = createFrameCoalescer()
  const s: WheelState = {
    scrollDelta: 0,
    zoomAccum: 0,
    target: undefined,
    lastClientX: 0,
    lastRafTime: null,
    lastZoomTime: null,
    lastEventTime: null,
    warnedNonCancelable: false,
  }

  // see releaseOnPointerLeave: drop any in-flight accumulation and stop consuming
  // latched wheel events, so a continued gesture pans/zooms nothing and chains to
  // the page instead of staying stuck to this element
  const presence = releaseOnPointerLeave
    ? trackPointerPresence(element, () => {
        s.scrollDelta = 0
        s.zoomAccum = 0
      })
    : undefined

  function flush(now: number) {
    const elapsed = wheelFrameElapsedMs(now, s.lastRafTime)
    s.lastRafTime = now
    const { target } = s
    if (target) {
      const origin = target.originElement()
      transaction(() => {
        if (s.zoomAccum !== 0 && origin) {
          const offset = s.lastClientX - origin.getBoundingClientRect().left
          for (const view of target.views) {
            view.zoomTo(
              applyZoomAccum(view.bpPerPx, s.zoomAccum, elapsed),
              offset,
            )
          }
        }
        if (s.scrollDelta !== 0) {
          for (const view of target.views) {
            view.horizontalScroll(s.scrollDelta)
          }
        }
      })
    }
    s.zoomAccum = 0
    s.scrollDelta = 0
  }

  function onWheel(event: WheelEvent) {
    onEvent?.(event)
    // Read before this handler does any preventDefault of its own. Wheel events
    // bubble, so a truthy value here means something nested inside already
    // claimed the gesture — a display scrolling its own reads or rows off
    // useVirtualScrollWheel. Those scrolls are virtual, painted from a model
    // offset rather than a DOM scroller, so this flag is the only trace they
    // leave.
    const claimed = event.defaultPrevented
    const gated = presence !== undefined && !presence.isOver
    const target = gated ? undefined : resolveTarget(event)
    if (target && !(event.shiftKey && target.scrollZoom)) {
      // a gap longer than the frame-elapsed clamp means this event starts a new
      // gesture, so the previous frame time is meaningless — including when it
      // predates a spell in a backgrounded tab, where a huge elapsed would
      // otherwise lift the zoom rate limit on the first frame back
      if (!isActivelyZooming(event.timeStamp, s.lastEventTime)) {
        s.lastRafTime = null
      }
      s.lastEventTime = event.timeStamp
      s.target = target

      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const isCtrlZoom = event.ctrlKey || event.metaKey
      const isZoom =
        isCtrlZoom ||
        (target.scrollZoom && Math.abs(deltaY) >= Math.abs(deltaX))

      if (isZoom) {
        // warn once per latched run, not once per event — a non-cancelable
        // sequence fires ~100 events/sec and console.warn is not free
        if (event.cancelable) {
          s.warnedNonCancelable = false
        } else if (!s.warnedNonCancelable) {
          s.warnedNonCancelable = true
          console.warn(
            '[wheelZoom] wheel event not cancelable — scroll sequence already in progress',
          )
        }
        event.preventDefault()
        s.zoomAccum += wheelZoomAccum(deltaY, isCtrlZoom)
        s.lastClientX = event.clientX
        s.lastZoomTime = event.timeStamp
        // drop any side-scroll accumulated earlier this frame — we're zooming,
        // and a deltaX that arrived just before the zoom is part of the same
        // noisy gesture
        s.scrollDelta = 0
      } else if (isActivelyZooming(event.timeStamp, s.lastZoomTime)) {
        // ignore stray horizontal deltas that arrive mid-zoom — trackpads emit
        // an unintentional side-scroll during a pinch/scroll-zoom gesture that
        // would otherwise pan the view away from where the user is zooming.
        // preventDefault anyway so the page itself doesn't scroll instead.
        event.preventDefault()
      } else {
        // With scrollZoom on, swallow the gesture even though it fell outside
        // the zoom threshold: without this, a diagonal trackpad gesture whose
        // |deltaX| slightly exceeds |deltaY| slips through and scrolls the page
        // (shift+wheel above is the deliberate escape hatch). With scrollZoom
        // off, only swallow what we are about to pan with, so a plain vertical
        // wheel isn't silently eaten.
        if (
          swallowUnhandled ||
          target.scrollZoom ||
          Math.abs(deltaX) > Math.abs(2 * deltaY)
        ) {
          event.preventDefault()
        }
        // A vertical gesture that got here is one the user meant as a zoom and
        // that nothing acted on — see onUnhandled. Everything else reaching
        // this branch is a pan, which is an action.
        if (Math.abs(deltaY) > Math.abs(deltaX) && !claimed) {
          onUnhandled?.(event)
        }
        s.scrollDelta = accumulateScroll(s.scrollDelta, deltaX)
      }

      frame.schedule(flush)
    }
  }

  element.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    element.removeEventListener('wheel', onWheel)
    presence?.dispose()
    // so a flush can't fire against a detached view
    frame.cancel()
  }
}
