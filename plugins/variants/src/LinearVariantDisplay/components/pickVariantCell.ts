import { topDrawnCell } from './variantCellLookup.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'
import { VARIANT_MARKS } from './variantMarks.ts'

import type { CellLookupData } from './variantCellLookup.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

export interface PickCellData extends CellLookupData, VariantUploadData {
  featurePositions: Uint32Array
}

interface PickedCell {
  cellIndex: number
  featureIndex: number
  // Screen row, so it indexes `model.drawnRows` and positions the hover highlight
  // directly.
  rowIndex: number
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
 * Each candidate feature — those overlapping the padded bp window — offers
 * the cell it paints on top over the row band `rowLowest..rowNearest` (one
 * row unless rows are sub-pixel), which is the largest cell index there, not
 * the nearest row's: a lower row's alt cell paints over a nearer reference
 * cell. Candidates whose *drawn* cell is not within the click tolerance of the
 * cursor are dropped, and the shortest survivor wins, which keeps a SNP inside
 * a large deletion selectable. Between two as short — a site split into one
 * record per allele — the later cell, painted on top, wins. Where the ink is
 * comes from the cell shape's own hit test.
 *
 * Rows are screen rows throughout, in and out; `rowUnmap` converts each to the
 * worker numbering the cell arrays are keyed by (see variantCellLookup.ts). A screen
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
  // Screen row -> worker row, or -1. See the display model's `rowUnmap`.
  rowUnmap: Int32Array
}): PickedCell | undefined {
  let best: PickedCell | undefined
  let bestLen = Infinity
  for (const featureIndex of candidateFeatures) {
    const top = topDrawnCell(
      data,
      rowUnmap,
      featureIndex,
      rowLowest,
      rowNearest,
    )
    if (top) {
      const { cellIndex, rowIndex } = top
      const len =
        data.featurePositions[featureIndex * 2 + 1]! -
        data.featurePositions[featureIndex * 2]!
      const onTop =
        len < bestLen || (len === bestLen && cellIndex > best!.cellIndex)
      if (
        onTop &&
        withinCellTolerance(data, block, state, mouseX, mouseY, cellIndex)
      ) {
        bestLen = len
        best = { cellIndex, featureIndex, rowIndex }
      }
    }
  }
  return best
}
