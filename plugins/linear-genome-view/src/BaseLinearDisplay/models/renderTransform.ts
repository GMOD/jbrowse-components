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
