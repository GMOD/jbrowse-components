// Native browsers latch a wheel gesture to the inner scroller: once an inner
// panel starts consuming scroll, continued momentum stays in that panel even
// after it reaches its boundary, and only after the gesture pauses does scroll
// chain to the outer page. Raw wheel bubbling lacks this — the event spills to
// the page the instant the panel hits its limit, so a single continuous gesture
// scrolls the page unexpectedly. createScrollLatch reproduces the native
// behavior in one place so every wheel handler gets it identically.

// gap between wheel events long enough to count as a new gesture; continuous
// trackpad/mouse scrolling fires every ~16ms, so 200ms reliably marks a pause
const LATCH_TIMEOUT_MS = 200

export function createScrollLatch(timeoutMs = LATCH_TIMEOUT_MS) {
  // timestamp of the previous wheel event (any event, not just ones that
  // moved the panel) and whether the current gesture has latched onto this
  // panel by actually scrolling it. A gap > timeoutMs between events marks a
  // pause, i.e. the start of a new gesture.
  let lastEvent = -Infinity
  let latched = false
  return {
    // Apply one wheel event to a vertical panel with native-style latching.
    // Given the current scroll offset, the delta (already normalized to
    // pixels), and the scrollable max (min defaults to 0), returns the clamped
    // new offset when the panel moves, or null when it stays put. preventDefault
    // fires both when the panel scrolls AND when it sits at a boundary mid-
    // gesture, so the page only takes over after the gesture pauses. The whole
    // boundary/latch/preventDefault contract lives here so no caller can derive
    // it incorrectly — they just apply the returned offset.
    //
    // Latching keys off gesture continuity, not panel movement: once a
    // continuous gesture has scrolled the panel it stays latched — suppressing
    // page scroll — through any amount of continued over-scroll at the
    // boundary, and only releases after the wheel events actually pause. A
    // gesture that *starts* at the boundary never latches, so it chains to the
    // page immediately (native behavior).
    scroll(e: WheelEvent, cur: number, delta: number, max: number, min = 0) {
      if (e.timeStamp - lastEvent >= timeoutMs) {
        latched = false
      }
      lastEvent = e.timeStamp
      const next = Math.max(min, Math.min(max, cur + delta))
      if (next !== cur) {
        latched = true
        e.preventDefault()
        return next
      }
      if (latched) {
        e.preventDefault()
      }
      return null
    },
    // Forget the gesture state so the next event is treated as a fresh gesture.
    // Called when the pointer leaves the panel: a gesture the browser has
    // latched to this element must not keep the page suppressed once the cursor
    // is elsewhere.
    reset() {
      lastEvent = -Infinity
      latched = false
    },
  }
}
