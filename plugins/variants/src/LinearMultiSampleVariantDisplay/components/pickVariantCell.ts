import { findCellIndex } from './variantCellLookup.ts'
import { variantCellSpanPx } from './variantCellSpan.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'

import type { CellLookupData } from './variantCellLookup.ts'

export interface PickCellData extends CellLookupData {
  cellCarriesAlt: Uint8Array
  featurePositions: Uint32Array
  featureInsertedBp: Int32Array
}

export interface PickedCell {
  cellIndex: number
  featureIndex: number
  // Screen row, so it indexes `model.sources` and positions the hover highlight
  // directly.
  rowIndex: number
  genomicStart: number
  genomicEnd: number
  // bp this record inserts, but only when *this* cell carries the alt — a
  // reference cell of an insertion record paints no marker, so its hover
  // highlight must not widen to one.
  insertedBp: number
}

/**
 * Resolve a cursor to the one cell it is over, or undefined.
 *
 * Rows are tried nearest-first (`rowNearest` down to `rowLowest`, equal unless
 * rows are sub-pixel), and the first row holding any cell wins. That is what
 * makes the pick predictable: the row comes from where the cursor is, not from
 * whatever a spatial index happened to return, and the nearest row is also the
 * last one painted there — so the cell that reports is the cell on top.
 *
 * Within a row, candidates are the features overlapping the padded bp window.
 * They are filtered to those whose *drawn* extent contains the cursor — the
 * window is padded out to the widest insertion marker, so most candidates at a
 * dense locus are not actually under it — and the shortest survivor wins, which
 * keeps a SNP inside a large deletion selectable.
 *
 * Rows are screen rows throughout, in and out; `rowUnmap` converts each to the
 * worker numbering `findCellIndex` searches (see variantCellLookup.ts). A screen
 * row the fetched data has no cells for maps to -1 and is skipped, which is the
 * same outcome as a row that simply holds no cell here.
 */
export function pickVariantCell({
  data,
  candidateFeatures,
  mouseX,
  rowNearest,
  rowLowest,
  rowUnmap,
  toX,
  pxPerBp,
  drawnRowHeight,
}: {
  data: PickCellData
  // Feature indices overlapping the cursor's bp window, from the per-feature
  // spatial index. Order is not significant.
  candidateFeatures: number[]
  mouseX: number
  rowNearest: number
  rowLowest: number
  // Screen row -> worker row, or -1. See MultiSampleVariantBaseModel.rowUnmap.
  rowUnmap: Int32Array
  // bp -> canvas px for this region, reversal already handled.
  toX: (bp: number) => number
  pxPerBp: number
  drawnRowHeight: number
}): PickedCell | undefined {
  for (let rowIndex = rowNearest; rowIndex >= rowLowest; rowIndex--) {
    const workerRow = rowIndex < rowUnmap.length ? rowUnmap[rowIndex]! : -1
    if (workerRow < 0) {
      continue
    }
    let best: PickedCell | undefined
    let bestLen = Infinity
    for (const featureIndex of candidateFeatures) {
      const cellIndex = findCellIndex(data, featureIndex, workerRow)
      if (cellIndex >= 0) {
        const genomicStart = data.featurePositions[featureIndex * 2]!
        const genomicEnd = data.featurePositions[featureIndex * 2 + 1]!
        const len = genomicEnd - genomicStart
        if (len < bestLen) {
          const insertedBp = data.cellCarriesAlt[cellIndex]
            ? data.featureInsertedBp[featureIndex]!
            : 0
          const { left, width } = variantCellSpanPx({
            x1: toX(genomicStart),
            x2: toX(genomicEnd),
            insertedBp,
            pxPerBp,
            drawnRowHeight,
          })
          if (
            mouseX >= left - HIT_TOLERANCE_PX &&
            mouseX <= left + width + HIT_TOLERANCE_PX
          ) {
            bestLen = len
            best = {
              cellIndex,
              featureIndex,
              rowIndex,
              genomicStart,
              genomicEnd,
              insertedBp,
            }
          }
        }
      }
    }
    if (best) {
      return best
    }
  }
  return undefined
}
