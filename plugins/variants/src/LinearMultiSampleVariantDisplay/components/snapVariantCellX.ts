import {
  snapCellEdgePx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'

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
 * Both rules are the shader's own, generated into TS (adr-051): the odd-looking
 * half-canvas offset inside `snapCellEdgePx` — which is what makes this parity
 * rather than an approximation to `Math.round` — and the 2px floor.
 */
export function snapVariantCellX(x1: number, x2: number, canvasWidth: number) {
  const lo = snapCellEdgePx(Math.min(x1, x2), canvasWidth)
  const hi = snapCellEdgePx(Math.max(x1, x2), canvasWidth)
  return { x: lo, width: snappedCellWidthPx(lo, hi) }
}
