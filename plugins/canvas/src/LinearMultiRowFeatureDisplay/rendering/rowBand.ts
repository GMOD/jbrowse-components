// Vertical band a row's blocks occupy: `rowProportion` of the row, centered, so
// a proportion below 1 leaves an even gutter above and below. One definition
// shared by the Canvas2D painter, the indel-glyph overlay, and the hover box, so
// none of them can inset a row differently from where the blocks land. The GPU
// path gets the same geometry from rowRect.slang.
export function rowBand(rowHeight: number, rowProportion: number) {
  const height = rowHeight * rowProportion
  return { height, offset: (rowHeight - height) / 2 }
}
