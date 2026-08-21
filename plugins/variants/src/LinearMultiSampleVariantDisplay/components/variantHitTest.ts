import { rowsUnderPointer } from '@jbrowse/core/util/rowStackGeometry'
import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { MAX_INSERTION_MARKER_WIDTH_PX } from './variantCellSpan.ts'

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
  // Rows whose drawn cell covers the cursor: `rowNearest` is the row the cursor
  // is actually in (and the last painted there), `rowLowest` the furthest row
  // still covering it under the 2px floor. Equal unless rows are sub-pixel.
  rowNearest: number
  rowLowest: number
  // Half-width of the bp search window so thin cells stay clickable.
  bpPadding: number
}

// Click tolerance around a cell's drawn extent: a 2px-wide cell would otherwise
// be near-impossible to hit.
export const HIT_TOLERANCE_PX = 5

// Half-width of the feature-interval search window. The intervals are the
// records' *reference* spans, but an insertion paints a marker up to
// MAX_INSERTION_MARKER_WIDTH_PX wide centered on that span (see
// variantCellSpan.ts), so the window has to reach a marker's far edge from the
// cursor or hovering the visible glyph returns nothing. Callers narrow the
// candidates back down to what each cell actually paints.
export const HIT_SEARCH_PAD_PX =
  MAX_INSERTION_MARKER_WIDTH_PX / 2 + HIT_TOLERANCE_PX

// Pure geometry for hit-testing one region: maps a cursor position (relative to
// the canvas) to a bp window and a row band. Split out from VariantComponent so
// the subtle reversed-region and sub-pixel-row math is unit-testable.
//
// The spatial index is per *feature* (see computeVariantCells), so x and y are
// resolved separately: x against the index, y arithmetically here. The caller
// then walks the row band nearest-first, asks variantCellLookup whether a cell
// exists at each (feature, row), and among those rejects any the cursor is not
// actually over — so a small variant atop a large one stays selectable.
export function computeVariantHitQuery(
  region: HitRegion,
  mouseX: number,
  mouseY: number,
  scrollTop: number,
  effectiveRowHeight: number,
): VariantHitQuery {
  const bpPerPx =
    (region.end - region.start) / (region.screenEndPx - region.screenStartPx)
  const genomicPos = bpAtPxExact(mouseX, region)

  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    { rowHeight: effectiveRowHeight, scrollTop },
    drawnCellHeightPx(effectiveRowHeight),
  )

  return {
    genomicPos,
    rowNearest: nearest,
    rowLowest: lowest,
    bpPadding: HIT_SEARCH_PAD_PX * bpPerPx,
  }
}
