/**
 * Shared coordinate transform for "single-global-RPC-result" displays
 * (HiC, LD) whose worker output is in fetch-time pixel space relative to
 * the first visible block's start. Pairs with `StaleViewportRescaleMixin`
 * (which provides `lastDrawnOffsetPx` / `lastDrawnBpPerPx`).
 *
 * The apex (data-x = 0) was rendered at canvas-x = `max(0, -lastDrawnOffsetPx)`
 * at fetch time → genome-pixel position `max(0, lastDrawnOffsetPx)` (in
 * fetch px units). Convert to current pixels and offset by the current
 * viewport:
 *
 *   viewOffsetX = max(0, lastDrawnOffsetPx) * scale - viewOffsetPx
 *
 * Reduces to `max(0, -viewOffsetPx)` when fresh (`lastDrawn === current`),
 * which is the gap when the user has scrolled left of genome start.
 *
 * `undefined` inputs are treated as fresh (no stale info yet).
 */
export interface RenderTransformInputs {
  lastDrawnOffsetPx: number | undefined
  lastDrawnBpPerPx: number | undefined
  viewOffsetPx: number
  viewBpPerPx: number
}

export interface RenderTransform {
  scale: number
  viewOffsetX: number
}

export function computeRenderTransform({
  lastDrawnOffsetPx,
  lastDrawnBpPerPx,
  viewOffsetPx,
  viewBpPerPx,
}: RenderTransformInputs): RenderTransform {
  const last = lastDrawnOffsetPx ?? viewOffsetPx
  const lastBpPerPx = lastDrawnBpPerPx ?? viewBpPerPx
  const scale = lastBpPerPx / viewBpPerPx
  const apexGenomePx = Math.max(0, last)
  return {
    scale,
    viewOffsetX: apexGenomePx * scale - viewOffsetPx,
  }
}

/**
 * Freshness test for the single-global-RPC-result displays: true only when the
 * committed data was drawn at exactly the current viewport (same `offsetPx` +
 * `bpPerPx`). The fetch autorun refetches on any pan/zoom and records the
 * viewport via `setLastDrawnViewport` *after* committing, so throughout the
 * debounce+RPC window that follows a viewport change these disagree. `renderTransform`
 * exploits that gap to reposition stale pixels for the *live* canvas; off-screen
 * SVG export must not — it gates `dataLoaded`/`svgReady` on this so it never
 * captures a matrix fetched for the pre-pan viewport. `undefined` lastDrawn
 * means nothing has been drawn yet, so it is not fresh.
 */
export function viewportMatchesLastDrawn({
  lastDrawnOffsetPx,
  lastDrawnBpPerPx,
  viewOffsetPx,
  viewBpPerPx,
}: RenderTransformInputs): boolean {
  return lastDrawnOffsetPx === viewOffsetPx && lastDrawnBpPerPx === viewBpPerPx
}

/**
 * Vertical squash factor for the fit-to-height triangle displays (HiC, LD).
 * A rotated contact matrix has a natural apex height of `triangleWidth / 2`;
 * when `fitToHeight` is on this stretches (or squashes) that apex into
 * `displayHeight`, otherwise it's identity. Kept on the main thread so a
 * resize only repaints — no worker refetch. Returns 1 for a degenerate
 * (zero-width) triangle so callers never divide by zero.
 */
export function computeTriangleYScalar({
  fitToHeight,
  displayHeight,
  triangleWidth,
}: {
  fitToHeight: boolean
  displayHeight: number
  triangleWidth: number
}): number {
  const triangleHeight = triangleWidth / 2
  return fitToHeight && triangleHeight > 0 ? displayHeight / triangleHeight : 1
}
