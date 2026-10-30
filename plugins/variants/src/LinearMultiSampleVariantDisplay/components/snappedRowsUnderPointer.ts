import {
  snappedRowBottomPx,
  snappedRowTopPx,
} from './shaders/variant.js.generated.ts'

/**
 * The rows whose drawn band covers the device pixel under `mouseY`, nearest
 * first — `rowsUnderPointer`'s answer for rows painted on the device grid
 * (`snappedRowTopPx`/`snappedRowBottomPx`, which both variant passes draw
 * with). `nearest` is the last row painted there and `lowest` the furthest one
 * whose floored band still reaches it.
 *
 * `dpr` is the scale the canvas backing store got (`backingScale`), the grid
 * the painters snapped to.
 */
export function snappedRowsUnderPointer(
  mouseY: number,
  stack: { rowHeight: number; scrollTop: number },
  drawnRowHeight: number,
  dpr: number,
) {
  const { rowHeight, scrollTop } = stack
  const y = (Math.floor(mouseY * dpr) + 0.5) / dpr
  const top = (row: number) => snappedRowTopPx(row, rowHeight, scrollTop, dpr)
  const bottom = (row: number) =>
    snappedRowBottomPx(row, rowHeight, drawnRowHeight, scrollTop, dpr)

  let nearest = Math.floor((y + scrollTop) / rowHeight)
  while (top(nearest) > y) {
    nearest--
  }
  while (top(nearest + 1) <= y) {
    nearest++
  }
  let lowest = Math.max(
    0,
    Math.floor((y + scrollTop - drawnRowHeight) / rowHeight) + 1,
  )
  while (lowest > 0 && bottom(lowest - 1) > y) {
    lowest--
  }
  while (lowest <= nearest && bottom(lowest) <= y) {
    lowest++
  }
  return { nearest, lowest }
}
