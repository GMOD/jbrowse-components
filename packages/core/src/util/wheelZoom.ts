// Shared wheel-zoom math for linear genome views. Both the LGV wheel handler
// (useWheelScroll) and the breakpoint-split overlay (useOverlayWheelZoom) zoom
// on ctrl/scroll-zoom wheel gestures and must behave identically — keeping the
// normalizer and rate-limit here is the single source of truth.

// max zoom delta per millisecond — equivalent to 0.2 per frame at 60fps
export const MAX_ZOOM_RATE_PER_MS = 0.2 / 16.67

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

// WheelEvent.deltaMode is pixels (0), lines (1), or pages (2); convert lines
// and pages to an approximate pixel delta
export function normalizeWheelDelta(delta: number, mode: number) {
  if (mode === 1) {
    return delta * 16
  }
  if (mode === 2) {
    return delta * 100
  }
  return delta
}

// elapsed since the previous animation frame, clamped to 100ms and defaulting
// to one 60fps frame when there is no prior frame (first event or post-resume)
export function wheelFrameElapsedMs(now: number, lastRafTime: number | null) {
  return Math.min(100, lastRafTime !== null ? now - lastRafTime : 16.67)
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
