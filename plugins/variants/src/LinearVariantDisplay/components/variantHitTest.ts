import Flatbush from '@jbrowse/core/util/flatbush'
import { bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'

import { MIN_CELL_PX } from './shaders/variant.consts.generated.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { snappedRowsUnderPointer } from './snappedRowsUnderPointer.ts'

// Minimal region shape the hit-test geometry needs — a subset of the view's
// visible-region objects.
export interface HitRegion {
  start: number
  end: number
  reversed?: boolean
  screenStartPx: number
  screenEndPx: number
}

interface VariantHitQuery {
  // Genomic position (absolute bp) under the cursor within this region.
  genomicPos: number
  // Rows whose drawn cell covers the cursor: `rowNearest` is the row the cursor
  // is actually in, `rowLowest` the furthest row whose cell still covers it. A
  // cell is its row from 1px up and nearer 2px as rows thin under a pixel, so
  // a lone carrier stays visible (`drawnCellHeightPx`): the two are equal
  // unless rows are sub-pixel.
  rowNearest: number
  rowLowest: number
  // Half-width of the bp search window: the click tolerance past a cell's
  // drawn extent, which the 2px floor (and a pixel of edge snapping) can carry
  // past its record's span.
  bpPadding: number
}

// Click tolerance around a cell's drawn extent: a 2px-wide cell would otherwise
// be near-impossible to hit.
export const HIT_TOLERANCE_PX = 5

// Pure geometry for hit-testing one region: maps a cursor position (relative to
// the canvas) to a bp window and a row band. Split out from VariantComponent so
// the subtle reversed-region and sub-pixel-row math is unit-testable.
//
// The spatial index is per *feature* (see computeVariantCells), so x and y are
// resolved separately: x against the index, y arithmetically here. The caller
// then takes each feature's top cell over the row band (`topDrawnCell`), and
// among those rejects any the cursor is not actually over — so a small variant
// atop a large one stays selectable.
export function computeVariantHitQuery(
  region: HitRegion,
  mouseX: number,
  mouseY: number,
  scrollTop: number,
  effectiveRowHeight: number,
  // the canvas backing store's y scale (`backingScale`)
  dpr: number,
): VariantHitQuery {
  const bpPerPx =
    (region.end - region.start) / (region.screenEndPx - region.screenStartPx)
  const genomicPos = bpAtPxExact(mouseX, region)

  const { nearest, lowest } = snappedRowsUnderPointer(
    mouseY,
    { rowHeight: effectiveRowHeight, scrollTop },
    drawnCellHeightPx(effectiveRowHeight),
    dpr,
  )

  return {
    genomicPos,
    rowNearest: nearest,
    rowLowest: lowest,
    bpPadding: (HIT_TOLERANCE_PX + MIN_CELL_PX + 1) * bpPerPx,
  }
}

// The features whose span overlaps the query's bp window, off the payload's
// per-feature index ([start, 0, end, 1] each), so the row half is left to the
// row band.
export function featuresNearCursor(
  featureIndexData: ArrayBuffer,
  { genomicPos, bpPadding }: VariantHitQuery,
) {
  return Flatbush.from(featureIndexData).search(
    genomicPos - bpPadding,
    0,
    genomicPos + bpPadding,
    1,
  )
}
