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

// Wheel deltaY arrives in one of three units (WheelEvent.deltaMode): pixels
// (0), lines (1), or pages (2). Convert lines and pages to pixels so a vertical
// panel can scroll by a consistent amount regardless of the source device.
export function normalizeWheelDeltaY(
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
) {
  return deltaMode === 1
    ? deltaY * 40
    : deltaMode === 2
      ? deltaY * viewportHeight
      : deltaY
}

export function createScrollLatch(timeoutMs = LATCH_TIMEOUT_MS) {
  let lastConsumed = -Infinity
  return {
    // Apply one wheel event to a vertical panel with native-style latching.
    // Given the current scroll offset, the delta (already normalized to
    // pixels), and the scrollable max (min defaults to 0), returns the clamped
    // new offset when the panel moves, or null when it stays put. preventDefault
    // fires both when the panel scrolls AND when it sits at a boundary mid-
    // gesture, so the page only takes over after the gesture pauses. The whole
    // boundary/latch/preventDefault contract lives here so no caller can derive
    // it incorrectly — they just apply the returned offset.
    scroll(e: WheelEvent, cur: number, delta: number, max: number, min = 0) {
      const next = Math.max(min, Math.min(max, cur + delta))
      if (next !== cur) {
        e.preventDefault()
        lastConsumed = e.timeStamp
        return next
      }
      if (e.timeStamp - lastConsumed < timeoutMs) {
        e.preventDefault()
      }
      return null
    },
  }
}
