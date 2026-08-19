import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'

import type { MafHover } from '../util.ts'
import type { HoverBp } from './findRowHover.ts'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

/**
 * The display slice the px hit-tests read. Structural rather than the full
 * model so these stay plain functions unit-testable with a literal — the whole
 * reason they live here instead of as MST views (mouse coordinates are a
 * view-layer input the model never produces, and argument-taking views get no
 * caching or reactivity from MST anyway).
 */
export interface MafHitTestModel {
  lgv: {
    pxToBp: (px: number) => PxToBpResult
    bpPerPx: number
  }
  scrollTop: number
  rowsTopOffset: number
  effectiveRowHeight: number
  rowHoverInfo: (
    displayedRegionIndex: number,
    bp: HoverBp,
    rowIndex: number,
    bpPerPx: number,
  ) => MafHover | undefined
}

/** The cursor projected into the display's coordinate systems. */
export interface MafPointer extends HoverBp {
  pos: PxToBpResult
  /** display row index; meaningless when `inBands`, and not range-checked */
  rowIndex: number
  /** cursor is over the stacked bands above the per-sample rows */
  inBands: boolean
}

/**
 * Project display-relative px onto the region, the genomic coordinate, and the
 * display row. Every pointer consumer — tooltip, cursor feedback, insertion
 * click, drag-selection context menu — goes through this, so none of them can
 * disagree about which cell or row the cursor is over. Each used to spell the
 * conversion itself, and the tooltip's copy had already drifted away from the
 * helper the others shared.
 */
export function mafPointerAt(
  model: MafHitTestModel,
  mouseX: number,
  mouseY: number,
): MafPointer {
  const pos = model.lgv.pxToBp(mouseX)
  return {
    pos,
    gposFrac: pos.reversed ? pos.end - pos.offset : pos.start + pos.offset,
    // The base *painted* at this pixel, which on a reversed region is not the
    // floor of `gposFrac` — see `HoverBp`.
    baseBp: basePaintedAt(pos, pos.offset),
    // At the centre of the pixel the cursor is in, for the same reason baseBp
    // is the base *painted* there: rasterization fills a pixel from its centre,
    // so that is where the row the reader is pointing at was decided. Asking at
    // the pixel's top edge misses by `0.5 / effectiveRowHeight` rows, which is
    // nothing at a 10px row and several once the rows go sub-pixel.
    rowIndex: Math.floor(rowAtY(model, Math.floor(mouseY) + 0.5)),
    inBands: mouseY < model.rowsTopOffset,
  }
}

type RowGeometry = Pick<
  MafHitTestModel,
  'scrollTop' | 'rowsTopOffset' | 'effectiveRowHeight'
>

// Continuous row coordinate at display-relative `y`. The one place the
// rows-area offset and scroll are applied; callers round to suit (a point hit
// floors, a span ceils its end).
function rowAtY(model: RowGeometry, y: number) {
  return (y + model.scrollTop - model.rowsTopOffset) / model.effectiveRowHeight
}

/**
 * Half-open `[startRow, endRow)` row range a vertical px span covers — the
 * drag-selection rectangle's rows, ready to `slice` the sample list with.
 */
export function rowSpanAtY(model: RowGeometry, y0: number, y1: number) {
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)
  return {
    startRow: Math.max(0, Math.floor(rowAtY(model, top))),
    endRow: Math.max(0, Math.ceil(rowAtY(model, bottom))),
  }
}

/** A projected cursor with its row hover already resolved. */
export interface MafPointerHit extends MafPointer {
  /**
   * The cursor is on a hoverable row: over the rows area, inside a displayed
   * region, and row resolution was requested.
   */
  onRow: boolean
  /**
   * The row hover (aligned base / insertion / deletion / bridged region) under
   * the cursor, or undefined when `onRow` is false or no fetched block covers
   * it.
   */
  hover: MafHover | undefined
}

/**
 * Project the cursor and resolve its row hover in one pass. The cursor style and
 * the tooltip both need the same answer for the same coordinates on every
 * mousemove, and resolving it here rather than in each of them halves the
 * per-move block scan (and means the pointer they show can't disagree).
 *
 * `resolveRowHover` false keeps the projection but skips the hover — the
 * drag-selection readout wants the coordinate, not the cell under it.
 */
export function resolveMafPointerHit({
  model,
  mouseX,
  mouseY,
  resolveRowHover,
}: {
  model: MafHitTestModel
  mouseX: number
  mouseY: number
  resolveRowHover: boolean
}): MafPointerHit {
  const pointer = mafPointerAt(model, mouseX, mouseY)
  const { pos, gposFrac, baseBp, rowIndex, inBands } = pointer
  const onRow = resolveRowHover && !pos.oob && !inBands
  return {
    ...pointer,
    onRow,
    hover: onRow
      ? model.rowHoverInfo(
          pos.index,
          { gposFrac, baseBp },
          rowIndex,
          model.lgv.bpPerPx,
        )
      : undefined,
  }
}

/**
 * The row hover under the cursor on its own, for the one-shot click path (which
 * has no projected pointer to reuse).
 */
export function resolveMafRowHover(
  model: MafHitTestModel,
  mouseX: number,
  mouseY: number,
): MafHover | undefined {
  return resolveMafPointerHit({ model, mouseX, mouseY, resolveRowHover: true })
    .hover
}
