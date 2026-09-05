import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

export { MULTI_ROW_MIN_CELL_PX }

// Higher than the multi-wiggle's xyplot rows, which sit on paper: blocks here
// are saturated fills edge to edge and swallow a fainter line.
export const SEPARATOR_OPACITY = 0.4

// The vertical band a row's blocks occupy, shared by the Canvas2D painter, the
// indel-glyph overlay and the hover box so none of them can inset a row
// differently from where the blocks land. The height is floored at
// MIN_DRAWN_ROW_PX: below a pixel a rect stops being drawable, so rows would
// thin out and then silently drop out as they got denser.
export function rowBand(rowHeight: number, rowProportion: number) {
  return {
    height: drawnRowHeightPx(rowHeight, rowProportion),
    offset: rowBandOffsetPx(rowHeight, rowProportion),
  }
}
