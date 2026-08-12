import {
  snappedCellLeftPx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'

/**
 * Snap a cell's horizontal extent to the same grid `shaders/variant.slang` uses,
 * so the Canvas2D backend and the SVG export (which goes through it) land on the
 * pixels the GPU render already drew. Without this the two disagree at sub-pixel
 * scale — every variant is thinner than 1px at genome-wide zoom, so the
 * disagreement is not a corner case there, it is every cell.
 *
 * **`x1`/`x2` are raw px in record order — `toX(start)`, `toX(end)` — not
 * sorted.** On a reversed block `makeBpMapper` flips, so `x2 < x1` and the
 * record's start is its *right* edge; `snappedCellLeftPx` reads that orientation
 * to hang the 2px floor off the start rather than off whichever edge is
 * leftmost. Sorting them first, or snapping before handing them over, silently
 * reinstates the bug the pivot exists to stop — see `spanLeft`, and the note in
 * variant.slang on why the snap has to happen inside.
 *
 * All three rules are the shader's own, generated into TS (adr-051): the
 * odd-looking half-canvas offset inside `snapCellEdgePx` — which is what makes
 * this parity rather than an approximation to `Math.round` — the 2px floor, and
 * the pivot the floor grows away from.
 */
export function snapVariantCellX(x1: number, x2: number, canvasWidth: number) {
  const width = snappedCellWidthPx(x1, x2, canvasWidth)
  return { x: snappedCellLeftPx(x1, x2, canvasWidth, width), width }
}
