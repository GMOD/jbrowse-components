import {
  snappedCellLeftPx,
  snappedCellWidthPx,
} from './shaders/variant.js.generated.ts'

/**
 * A cell's horizontal extent on the grid `shaders/variant.slang` snaps to, for
 * a consumer holding px edges rather than a `cellMark` instance.
 *
 * **`x1`/`x2` are raw px in record order — `toX(start)`, `toX(end)` — not
 * sorted.** On a reversed block `x2 < x1`, and `snappedCellLeftPx` hangs the
 * 2px floor off the record's start; sorting or pre-snapping the edges moves a
 * sub-pixel record off the cell `cellMark` paints.
 */
export function snapVariantCellX(x1: number, x2: number) {
  const width = snappedCellWidthPx(x1, x2)
  return { x: snappedCellLeftPx(x1, x2, width), width }
}
