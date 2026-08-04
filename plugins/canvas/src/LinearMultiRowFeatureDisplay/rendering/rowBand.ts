import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { MIN_DRAWN_ROW_PX } from '@jbrowse/render-core/shaders/rowRectConsts'

// Vertical band a row's blocks occupy: `rowProportion` of the row, centered, so
// a proportion below 1 leaves an even gutter above and below. One definition
// shared by the Canvas2D painter, the indel-glyph overlay, and the hover box, so
// none of them can inset a row differently from where the blocks land — and, via
// the generated twins below, by the GPU path too (adr-051). `rowRect.slang`
// packages the pair as a `RowBand` struct for its vertex stage; that struct is
// the only part of this that isn't shared.
//
// MIN_DRAWN_ROW_PX is the thinnest a row is ever *painted*, however thin the row
// itself is.
//
// Rows are allowed below a pixel: a few thousand of them in a fixed-height
// display is a legitimate overview, and the alternative (refusing to fit, and
// growing the track to a pixel a row) is a track thousands of pixels tall. But
// below a pixel a rect stops being drawable — Canvas2D fades it towards nothing
// and a GPU quad can miss every pixel center and vanish — so rows would thin out
// and then silently drop out as they got denser.
//
// Painting them at a pixel instead makes neighbours overlap, so a pixel shows
// one of the rows that share it rather than all of them. That is a real loss,
// and it is why clustering matters at this density: with similar rows adjacent,
// whichever one wins a pixel stands for its neighbours.
export { MIN_DRAWN_ROW_PX }

// Height a row's blocks are painted at. Distinct from the row's own height,
// which stays sub-pixel so that `nrow * rowHeight` still fits the display.
export { drawnRowHeightPx as drawnRowHeight }

// Smallest row height an inter-row separator is drawn at (MultiRowSeparatorLines
// and the track-menu toggle that describes it). A 1px line between rows that are
// themselves 2px tall is half the picture, and rows are allowed below a pixel
// (above) — at that density the grid would be the figure.
export const MIN_SEPARATOR_ROW_PX = 4

export function rowBand(rowHeight: number, rowProportion: number) {
  return {
    height: drawnRowHeightPx(rowHeight, rowProportion),
    offset: rowBandOffsetPx(rowHeight, rowProportion),
  }
}
