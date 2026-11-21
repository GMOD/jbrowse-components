import { backingScale } from '@jbrowse/render-core/canvas2dUtils'

import { topDrawnCell } from './variantCellLookup.ts'
import { HIT_TOLERANCE_PX } from './variantHitTest.ts'
import { VARIANT_MARKS } from './variantMarks.ts'

import type { CellLookupData } from './variantCellLookup.ts'
import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'

export interface PickCellData extends CellLookupData, VariantUploadData {}

interface PickedCell {
  cellIndex: number
  featureIndex: number
  // Screen row, so it indexes `model.drawnRows` and positions the hover highlight
  // directly.
  rowIndex: number
}

const CELL_MARK = VARIANT_MARKS[0]!
const TOLERANCE_SQ = HIT_TOLERANCE_PX ** 2

interface CellHit extends PickedCell {
  distSq: number
}

function distSqWithinTolerance(
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
    ? hit.distSq
    : undefined
}

function paintsOverInside(
  { cellPositions }: VariantUploadData,
  near: CellHit,
  under: CellHit,
) {
  return (
    near.cellIndex > under.cellIndex &&
    cellPositions[near.cellIndex * 2]! >= cellPositions[under.cellIndex * 2]! &&
    cellPositions[near.cellIndex * 2 + 1]! <=
      cellPositions[under.cellIndex * 2 + 1]!
  )
}

function nearestThenTop(best: CellHit | undefined, hit: CellHit) {
  return !best ||
    hit.distSq < best.distSq ||
    (hit.distSq === best.distSq && hit.cellIndex > best.cellIndex)
    ? hit
    : best
}

function deviceCentrePx(cssPx: number, state: VariantRenderState) {
  const dpr = state.snapScale ?? backingScale(state.canvasWidth)
  return (Math.floor(cssPx * dpr) + 0.5) / dpr
}

/**
 * Resolve a cursor to the one cell it is over, or undefined.
 *
 * Each candidate feature — those overlapping the padded bp window — offers
 * the cell it paints on top over the row band `rowLowest..rowNearest` (one
 * row unless rows are sub-pixel), which is the largest cell index there, not
 * the nearest row's: a lower row's alt cell paints over a nearer reference
 * cell. The cursor is taken at the centre of its device pixel, as the cells
 * are snapped to that grid, so it never sits on a shared edge. Candidates
 * whose *drawn* cell is not within the click tolerance of it are dropped. Of
 * the survivors, the top cell the cursor is on wins, unless a cell painted
 * after it whose bp span lies within its span is within the tolerance — a SNP
 * inside a large deletion, as cells paint in index order with records laid
 * out longest first (`recordsByBlock`) — and then the nearest of those wins.
 * With the cursor on no cell, the nearest survivor wins. Ties go to the cell
 * painted last. Distances come from the cell shape's own hit test.
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
  const x = deviceCentrePx(mouseX, state)
  const hits: CellHit[] = []
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
      const distSq = distSqWithinTolerance(
        data,
        block,
        state,
        x,
        mouseY,
        cellIndex,
      )
      if (distSq !== undefined) {
        hits.push({ cellIndex, featureIndex, rowIndex, distSq })
      }
    }
  }
  const under = hits
    .filter(hit => hit.distSq === 0)
    .reduce<CellHit | undefined>(nearestThenTop, undefined)
  const contenders = under
    ? hits.filter(hit => paintsOverInside(data, hit, under))
    : hits
  return (
    contenders.reduce<CellHit | undefined>(nearestThenTop, undefined) ?? under
  )
}
