import { rowsUnderPointer } from '@jbrowse/core/util/rowStackGeometry'

import { drawnCellHeightPx } from './shaders/variantMatrix.js.generated.ts'

/** What the cursor projection reads off the matrix display model. */
export interface MatrixHitGeometry {
  /** the pitch the canvas and the connector lines lay columns out on */
  columnWidth: number
  effectiveRowHeight: number
  scrollTop: number
}

/**
 * The matrix cell under canvas-relative px.
 *
 * Screen column and data index are the same number, the rows having been
 * ordered by screen position already.
 *
 * `nearest`/`lowest` are the rows sharing the drawn pixel — the matrix floors
 * cell height at 1px, so at the 2,504-sample fit height (0.09px a row) eleven
 * rows land under one, and the caller walks them nearest-first until one has a
 * genotype to report. Picking `nearest` alone leaves the other ten silent.
 *
 * Split out of the component because it is the arithmetic that goes wrong: the
 * pixel-centre and floor-ordering fixes both landed on the sibling display
 * while this spelling, having no test file to fail, kept naming a row 5 off.
 */
export function matrixCellAt(
  geom: MatrixHitGeometry,
  mouseX: number,
  mouseY: number,
) {
  const { columnWidth, effectiveRowHeight: rowHeight, scrollTop } = geom
  return {
    featureIdx: Math.floor(mouseX / columnWidth),
    ...rowsUnderPointer(
      mouseY,
      { rowHeight, scrollTop },
      drawnCellHeightPx(rowHeight),
    ),
  }
}
