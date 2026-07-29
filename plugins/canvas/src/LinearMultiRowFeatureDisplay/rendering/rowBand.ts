// Vertical band a row's blocks occupy: `rowProportion` of the row, centered, so
// a proportion below 1 leaves an even gutter above and below. One definition
// shared by the Canvas2D painter, the indel-glyph overlay, and the hover box, so
// none of them can inset a row differently from where the blocks land. The GPU
// path mirrors this in rowRect.slang's `rowBandPx` — keep the two in step.

// Thinnest a row is ever *painted*, however thin the row itself is.
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
export const MIN_DRAWN_ROW_PX = 1

// Height a row's blocks are painted at. Distinct from the row's own height,
// which stays sub-pixel so that `nrow * rowHeight` still fits the display.
export function drawnRowHeight(rowHeight: number, rowProportion: number) {
  return Math.max(rowHeight * rowProportion, MIN_DRAWN_ROW_PX)
}

export function rowBand(rowHeight: number, rowProportion: number) {
  const height = drawnRowHeight(rowHeight, rowProportion)
  // Centered on the row, so a floored band overhangs its row evenly on both
  // sides rather than pushing every row down.
  return { height, offset: (rowHeight - height) / 2 }
}
