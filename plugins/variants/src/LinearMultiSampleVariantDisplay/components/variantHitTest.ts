// Minimal region shape the hit-test geometry needs — a subset of the view's
// visible-region objects.
export interface HitRegion {
  start: number
  end: number
  reversed?: boolean
  screenStartPx: number
  screenEndPx: number
}

export interface VariantHitQuery {
  // Genomic position (absolute bp) under the cursor within this region.
  genomicPos: number
  // Row-index band whose 2px-min boxes overlap the cursor Y.
  rowLo: number
  rowHi: number
  // Half-width of the bp search window (5px worth of bp) so thin cells stay
  // clickable.
  bpPadding: number
}

// Pure geometry for hit-testing one region: maps a cursor position (relative to
// the canvas) to the flatbush query window. Split out from VariantComponent so
// the subtle reversed-region and sub-pixel-row math is unit-testable.
//
// The flatbush stores each cell as the Y-box [rowIndex, rowIndex+1] (see
// computeVariantCells.ts), so the query [rowLo, rowHi] must be the band of
// *rows* whose drawn cell overlaps the cursor — expressed in row units, and
// accounting for that unit-wide box. Row i draws from content-Y i*rowHeight for
// max(rowHeight, 2) px (the 2px-min mirrors max(u.rowHeight, 2.0) in
// shaders/variant.slang + Canvas2DVariantRenderer.ts), so the cursor at content
// Y (mouseY+scrollTop) overlaps rows in (cursorRow - max(1, 2/rowHeight),
// cursorRow]. For normal rows (rowHeight ≥ 2) that collapses to the single row
// floor(cursorRow); only sub-pixel rows (which stack many under one drawn pixel)
// span a real band. The caller then picks the shortest feature so a small
// variant atop a large one stays selectable. The `+1` offsets the box's own unit
// width so the row *above* the cursor isn't dragged into the query.
export function computeVariantHitQuery(
  region: HitRegion,
  mouseX: number,
  mouseY: number,
  scrollTop: number,
  effectiveRowHeight: number,
): VariantHitQuery {
  const blockWidth = region.screenEndPx - region.screenStartPx
  const regionLengthBp = region.end - region.start
  const bpPerPx = regionLengthBp / blockWidth

  const frac = (mouseX - region.screenStartPx) / blockWidth
  const genomicPos = region.reversed
    ? region.end - frac * regionLengthBp
    : region.start + frac * regionLengthBp

  const drawnRowsSpan = Math.max(effectiveRowHeight, 2) / effectiveRowHeight
  const cursorRow = (mouseY + scrollTop) / effectiveRowHeight
  const rowHi = cursorRow
  const rowLo = cursorRow - drawnRowsSpan + 1

  return { genomicPos, rowLo, rowHi, bpPadding: 5 * bpPerPx }
}
