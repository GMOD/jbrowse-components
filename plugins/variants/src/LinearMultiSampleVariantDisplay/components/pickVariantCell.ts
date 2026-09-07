import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { findCellIndex } from './variantCellLookup.ts'
import { variantCellSpanPx } from './variantCellSpan.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'
import { VARIANT_MARKS } from './variantMarks.ts'

import type { CellLookupData } from './variantCellLookup.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

export interface PickCellData extends CellLookupData, VariantUploadData {
  cellAltDosage: Uint8Array
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

const CELL_MARK = VARIANT_MARKS[0]!
const TOLERANCE_SQ = HIT_TOLERANCE_PX ** 2

function withinCellTolerance(
  data: VariantUploadData,
  block: VariantRenderBlock,
  state: VariantRenderState,
  mouseX: number,
  mouseY: number,
  cellIndex: number,
) {
  const hit = CELL_MARK.hitNearest!(
    data,
    block,
    state,
    mouseX,
    mouseY,
    [cellIndex],
    Infinity,
  )
  return hit !== undefined && hit.distSq <= TOLERANCE_SQ
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
 * They are filtered to those whose *drawn* extent is within the click
 * tolerance of the cursor — the window is padded out to the widest insertion
 * marker, so most candidates at a dense locus are not actually under it — and
 * the shortest survivor wins, which keeps a SNP inside a large deletion
 * selectable. Where the ink is comes from the cell shape's own hit test for
 * every cell but one that paints an insertion marker, whose widened extent is
 * the overlay's (`variantCellSpanPx`).
 *
 * Rows are screen rows throughout, in and out; `rowUnmap` converts each to the
 * worker numbering `findCellIndex` searches (see variantCellLookup.ts). A screen
 * row the fetched data has no cells for maps to -1 and is skipped, which is the
 * same outcome as a row that simply holds no cell here.
 */
export function pickVariantCell({
  data,
  block,
  state,
  candidateFeatures,
  mouseX,
  mouseY,
  rowNearest,
  rowLowest,
  rowUnmap,
  pxPerBp,
  insertionsWiden,
}: {
  data: PickCellData
  block: VariantRenderBlock
  state: VariantRenderState
  // Feature indices overlapping the cursor's bp window, from the per-feature
  // spatial index. Order is not significant.
  candidateFeatures: number[]
  mouseX: number
  mouseY: number
  rowNearest: number
  rowLowest: number
  // Screen row -> worker row, or -1. See MultiSampleVariantBaseModel.rowUnmap.
  rowUnmap: Int32Array
  pxPerBp: number
  // The display's `showInsertionGlyphs`: with it off an insertion is a 2px cell
  // and its click target has to be one too. See `variantCellSpanPx`.
  insertionsWiden: boolean
}): PickedCell | undefined {
  const toX = makeBpMapper(block)
  const drawnRowHeight = drawnCellHeightPx(state.rowHeight)
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
          const insertedBp = data.cellAltDosage[cellIndex]
            ? data.featureInsertedBp[featureIndex]!
            : 0
          const marker =
            insertionsWiden && insertedBp > 0
              ? variantCellSpanPx({
                  canvasWidth: state.canvasWidth,
                  x1: toX(genomicStart),
                  x2: toX(genomicEnd),
                  insertedBp,
                  insertionsWiden,
                  pxPerBp,
                  drawnRowHeight,
                })
              : undefined
          const over = marker?.drawsMarker
            ? mouseX >= marker.left - HIT_TOLERANCE_PX &&
              mouseX <= marker.left + marker.width + HIT_TOLERANCE_PX
            : withinCellTolerance(data, block, state, mouseX, mouseY, cellIndex)
          if (over) {
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
