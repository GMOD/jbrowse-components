/**
 * Mouse-Y → row index for the displays that stack rows behind
 * `useRowVirtualScroll`.
 *
 * That hook is what makes the arithmetic subtle, so the reader lives beside it.
 * `applyRowResizeWheel` sets `scrollTop` to `rowUnderMouse * newRowHeight -
 * mouseY` to pin the row under the cursor, which leaves it fractional, and it
 * lets `rowHeight` fall to `viewportHeight / nrow` — sub-pixel on a
 * cohort-sized track. Two rules follow, and each caller used to restate them:
 *
 * - **Ask at the pixel's centre.** Rasterization fills a pixel when its centre
 *   falls inside the rect, so the centre is the scanline the colour the reader
 *   is pointing at was decided on. The top edge misses by `0.5 / rowHeight`
 *   rows — 5.4 of them on a 2,504-sample matrix at the default fit height.
 * - **Floor `mouseY` before adding `scrollTop`.** The canvas draws at
 *   `row * rowHeight - scrollTop` with `scrollTop` unrounded; flooring the sum
 *   snaps to a pixel grid the content is not on. This is the half a reader gets
 *   backwards.
 */

export interface RowStack {
  /** resolved height, never the 0/fit sentinel — this is divided into */
  rowHeight: number
  /** unrounded, and routinely fractional */
  scrollTop?: number
  /** chrome above the rows area, e.g. MAF's stacked bands */
  topOffset?: number
}

/** Content-space Y of the centre of the screen pixel `mouseY` is in. */
export function contentYAt(mouseY: number, stack: RowStack) {
  const { scrollTop = 0, topOffset = 0 } = stack
  return Math.floor(mouseY) + 0.5 + scrollTop - topOffset
}

/** Continuous row coordinate at `mouseY`; callers round to suit. */
export function rowCoordAt(mouseY: number, stack: RowStack) {
  return contentYAt(mouseY, stack) / stack.rowHeight
}

/** The row `mouseY` is on. Negative above the rows area, and not range-checked. */
export function rowIndexAt(mouseY: number, stack: RowStack) {
  return Math.floor(rowCoordAt(mouseY, stack))
}

/**
 * Half-open `[startRow, endRow)` covered by a vertical px span, ready to
 * `slice` a sample list with.
 *
 * Both ends are the row at that pixel's centre and the range includes both, so
 * a span can never come back empty: a drag straight across one row — which
 * `useDragSelection` supports, gating on X alone — covers the row it is on.
 * Taking `endRow` as the `ceil` of the same coordinate instead collapsed on
 * every exact row boundary, one pixel row in every `rowHeight`.
 */
export function rowSpanAt(y0: number, y1: number, stack: RowStack) {
  const first = rowIndexAt(Math.min(y0, y1), stack)
  const last = rowIndexAt(Math.max(y0, y1), stack)
  return { startRow: Math.max(0, first), endRow: Math.max(0, last + 1) }
}

/**
 * The rows whose *drawn* cell covers `mouseY`, nearest first.
 *
 * Row r occupies `[r*rowHeight, r*rowHeight + drawnRowHeight)`.
 * `drawnRowHeight` is the height the painter *resolved* for this `rowHeight`,
 * not the floor it clamps to — pass `drawnCellHeightPx(rowHeight)` from the
 * module generated out of the display's own shader (ADR-051), so what is
 * painted and what is pickable stay one rule. At `rowHeight` above the floor it
 * equals `rowHeight`, the band collapses to `nearest`, and only sub-pixel rows
 * stack several under one drawn pixel — where the last drawn wins, and
 * `nearest` is it.
 *
 * Walking down to `lowest` keeps those rows hoverable when the nearest one has
 * nothing to report.
 */
export function rowsUnderPointer(
  mouseY: number,
  stack: RowStack,
  drawnRowHeight: number,
) {
  const y = contentYAt(mouseY, stack)
  const { rowHeight } = stack
  return {
    nearest: Math.floor(y / rowHeight),
    lowest: Math.max(0, Math.floor((y - drawnRowHeight) / rowHeight) + 1),
  }
}
