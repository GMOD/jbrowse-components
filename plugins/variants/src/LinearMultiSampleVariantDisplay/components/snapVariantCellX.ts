/**
 * Snap a cell's horizontal extent to the same grid `shaders/variant.slang` uses,
 * so the Canvas2D backend and the SVG export (which goes through it) land on the
 * pixels the GPU render already drew. Without this the two disagree at sub-pixel
 * scale — every variant is thinner than 1px at genome-wide zoom, so the
 * disagreement is not a corner case there, it is every cell.
 *
 * `x1`/`x2` are the cell's reference span mapped to block screen space, either
 * order (reversed blocks hand them back swapped).
 *
 * The odd-looking `canvasWidth / 2` offset is not decoration: the shader snaps
 * in *clip* space, where `clipX / pxSize` evaluates to `px - canvasWidth / 2`
 * (clip spans 2 units across `canvasWidth` px). Rounding that and converting
 * back therefore lands on whole pixels only when `canvasWidth` is even, and on
 * half-pixels when it is odd. Reproducing the offset rather than calling
 * `Math.round` is what makes this parity instead of an approximation.
 */
export function snapVariantCellX(x1: number, x2: number, canvasWidth: number) {
  const half = canvasWidth / 2
  const lo = Math.floor(Math.min(x1, x2) - half + 0.5) + half
  const hi = Math.floor(Math.max(x1, x2) - half + 0.5) + half
  // 2px floor so a lone cell in a sparse matrix stays visible. Mirrors
  // `max(..., cx1 + 2.0 * pxSize)` in shaders/variant.slang and the floor in
  // variantCellSpan.ts / variantCellLookup.ts — keep in sync.
  return { x: lo, width: Math.max(2, hi - lo) }
}
