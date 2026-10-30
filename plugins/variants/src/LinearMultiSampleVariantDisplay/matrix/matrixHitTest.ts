import { snappedRowsUnderPointer } from '../components/snappedRowsUnderPointer.ts'
import { drawnCellHeightPx } from './shaders/variantMatrix.js.generated.ts'

/** What the cursor projection reads off the display under the columns layout. */
interface MatrixHitGeometry {
  /** the pitch the canvas and the connector lines lay columns out on */
  columnWidth: number
  effectiveRowHeight: number
  scrollTop: number
  /** the canvas backing store's y scale (`backingScale`) */
  dpr: number
}

/**
 * The matrix cell under canvas-relative px.
 *
 * Screen column and data index are the same number, the rows having been
 * ordered by screen position already.
 *
 * `nearest`/`lowest` are the rows sharing the drawn pixel — the matrix floors
 * cell height at 1px, so at the 2,504-sample fit height (0.09px a row) eleven
 * rows land under one, and the caller reports the one whose cell paints on
 * top.
 */
export function matrixCellAt(
  geom: MatrixHitGeometry,
  mouseX: number,
  mouseY: number,
) {
  const { columnWidth, effectiveRowHeight: rowHeight, scrollTop, dpr } = geom
  return {
    featureIdx: Math.floor(mouseX / columnWidth),
    ...snappedRowsUnderPointer(
      mouseY,
      { rowHeight, scrollTop },
      drawnCellHeightPx(rowHeight),
      dpr,
    ),
  }
}
