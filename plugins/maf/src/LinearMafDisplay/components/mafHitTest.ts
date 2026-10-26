import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  rowIndexAt,
  rowsUnderPointer,
} from '@jbrowse/core/util/rowStackGeometry'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import type { GenomicPosition, MafHover } from '../util.ts'
import type { HoverBp } from './findRowHover.ts'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

/**
 * The display slice the px hit tests read. Structural, so these stay plain
 * functions unit-testable with a literal.
 */
export interface MafHitTestModel {
  view: {
    pxToBp: (px: number) => PxToBpResult
    bpPerPx: number
  }
  scrollTop: number
  rowsTopOffset: number
  rowsHeight: number
  effectiveRowHeight: number
  rowProportion: number
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
 * Project display-relative px onto the region, the genomic coordinate and the
 * display row. Every pointer consumer (tooltip, cursor feedback, insertion
 * click, drag-selection menu) goes through this, so none disagree about the
 * cell or row under the cursor.
 */
export function mafPointerAt(
  model: MafHitTestModel,
  mouseX: number,
  mouseY: number,
): MafPointer {
  const pos = model.view.pxToBp(mouseX)
  return {
    pos,
    gposFrac: pos.reversed ? pos.end - pos.offset : pos.start + pos.offset,
    // The base *painted* at this pixel, which on a reversed region is not the
    // floor of `gposFrac` — see `HoverBp`.
    baseBp: basePaintedAt(pos, pos.offset),
    rowIndex: rowIndexUnder(model, mouseY),
    inBands: mouseY < model.rowsTopOffset,
  }
}

/**
 * The 1-based position a tooltip caption names: the base painted under the
 * pointer, which on a reversed region is not `pos.coord`.
 */
export function pointerLocation({
  pos,
  baseBp,
}: Pick<MafPointer, 'pos' | 'baseBp'>): GenomicPosition {
  return { refName: pos.refName, coord: baseBp + 1 }
}

type RowGeometry = Pick<
  MafHitTestModel,
  'scrollTop' | 'rowsTopOffset' | 'effectiveRowHeight' | 'rowProportion'
>

function rowStackOf(model: RowGeometry) {
  return {
    rowHeight: model.effectiveRowHeight,
    scrollTop: model.scrollTop,
    topOffset: model.rowsTopOffset,
  }
}

/**
 * The row whose color the pixel carries, which is not always the row whose slot
 * the pixel centre falls in. Both painters floor a row's height at
 * `MIN_DRAWN_ROW_PX` (`rowRect.slang`), so below a pixel per row bands overlap
 * and the highest index paints last; above the floor a pixel in the gutter
 * between bands answers with its slot.
 */
function rowIndexUnder(model: RowGeometry, mouseY: number) {
  const { effectiveRowHeight: rowHeight, rowProportion } = model
  const { nearest, lowest } = rowsUnderPointer(
    mouseY,
    {
      rowHeight,
      scrollTop: model.scrollTop,
      topOffset:
        model.rowsTopOffset + rowBandOffsetPx(rowHeight, rowProportion),
    },
    drawnRowHeightPx(rowHeight, rowProportion),
  )
  return nearest >= lowest ? nearest : rowIndexAt(mouseY, rowStackOf(model))
}

/**
 * Half-open `[startRow, endRow)` row range a vertical px span covers — the
 * drag-selection rectangle's rows, ready to `slice` the sample list with.
 * Only the part of the span over the rows viewport counts, so a drag inside
 * the bands covers no row. Each edge takes the row the hover names at that
 * pixel, so below a pixel per row the selection starts and ends on the rows
 * the tooltip showed there.
 */
export function rowSpanAtY(
  model: RowGeometry & Pick<MafHitTestModel, 'rowsHeight'>,
  y0: number,
  y1: number,
) {
  const top = model.rowsTopOffset
  const lo = Math.max(Math.min(y0, y1), top)
  const hi = Math.min(Math.max(y0, y1), top + model.rowsHeight - 1)
  return lo <= hi
    ? {
        startRow: Math.max(0, rowIndexUnder(model, lo)),
        endRow: Math.max(0, rowIndexUnder(model, hi) + 1),
      }
    : { startRow: 0, endRow: 0 }
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
 * Project the cursor and resolve its row hover in one pass, so the cursor style
 * and the tooltip share one block scan per mousemove. `resolveRowHover` false
 * keeps the projection but skips the hover; the drag-selection readout wants
 * the coordinate, not the cell.
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
          model.view.bpPerPx,
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
