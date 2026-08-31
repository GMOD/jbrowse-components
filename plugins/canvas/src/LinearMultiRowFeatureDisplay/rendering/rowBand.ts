import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { MULTI_ROW_MIN_CELL_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

// Narrowest a cell is painted, the horizontal twin of the shader's
// MIN_DRAWN_ROW_PX row floor and the same constant this display writes into
// `rowRectVertex`'s `minCellPx` uniform. Re-exported here so the Canvas2D
// painter reads both floors from one place, as it already read the band.
//
// Two px rather than the bare drawable-at-all one MAF takes: a painting's
// features are sparse intervals, so at chromosome zoom a repeat element is a
// lone tick on white paper, and a one-px tick anti-aliased across two pixel
// columns reaches full opacity in neither.
export { MULTI_ROW_MIN_CELL_PX }

// Alpha the separator takes over this display's painting. Higher than the
// multi-wiggle's xyplot rows, which sit on paper: blocks here are saturated
// fills edge to edge (rowProportion 1) and swallow a fainter line.
export const SEPARATOR_OPACITY = 0.4

// Vertical band a row's blocks occupy: `rowProportion` of the row, centered, so
// a proportion below 1 leaves an even gutter above and below. One definition
// shared by the Canvas2D painter, the indel-glyph overlay, and the hover box, so
// none of them can inset a row differently from where the blocks land — and, via
// the generated twins it calls, by the GPU path too (adr-051). `rowRect.slang`
// packages the pair as a `RowBand` struct for its vertex stage; that struct is
// the only part of this that isn't shared.
//
// The height is floored at the shader's MIN_DRAWN_ROW_PX, the thinnest a row is
// ever PAINTED however thin the row itself is. Rows are allowed below a pixel —
// a few thousand in a fixed-height display is a legitimate overview, and
// refusing to fit means a track thousands of px tall — but below a pixel a rect
// stops being drawable, so rows would thin out and then silently drop out as
// they got denser. Painting them at a pixel instead makes neighbours overlap, so
// a pixel shows one of the rows that share it; that is why clustering matters at
// this density.
export function rowBand(rowHeight: number, rowProportion: number) {
  return {
    height: drawnRowHeightPx(rowHeight, rowProportion),
    offset: rowBandOffsetPx(rowHeight, rowProportion),
  }
}
