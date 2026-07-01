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
  // Row-index band whose 1px-min boxes overlap the cursor Y.
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
// Rows under 1px draw 1px tall, so sub-pixel rows stack under one cursor pixel.
// The query spans the band of rows whose 1px-min box overlaps the cursor (a
// single Y-point misses sparse rows with no cell under the column); the caller
// then picks the shortest feature so a small variant atop a large one stays
// selectable. The 1px-min mirrors max(u.rowHeight, 1.0) in shaders/variant.slang
// + Canvas2DVariantRenderer.ts — keep the three in sync.
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

  const drawnRowHeight = Math.max(effectiveRowHeight, 1)
  const rowLo = (mouseY - drawnRowHeight + scrollTop) / effectiveRowHeight
  const rowHi = (mouseY + 1 + scrollTop) / effectiveRowHeight

  return { genomicPos, rowLo, rowHi, bpPadding: 5 * bpPerPx }
}
