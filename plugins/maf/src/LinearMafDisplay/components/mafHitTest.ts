import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import {
  rowIndexAt,
  rowSpanAt,
  rowsUnderPointer,
} from '@jbrowse/core/util/rowStackGeometry'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

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
  view: {
    pxToBp: (px: number) => PxToBpResult
    bpPerPx: number
  }
  scrollTop: number
  rowsTopOffset: number
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
 * The row whose colour the pixel carries, which is not always the row whose
 * slot the pixel centre falls in.
 *
 * Both painters put a row's band at `rowBandOffsetPx` inside its slot and floor
 * its height at `MIN_DRAWN_ROW_PX` (`maf.slang`'s `rowRectClipPos`,
 * `drawMafBlocks`'s `rowBandGeometry`). Below a pixel per row the floor makes
 * neighbouring bands overlap, several rows paint the same pixel, and the last
 * one drawn — the highest index — is the one on screen; `rowIndexAt` answered
 * with the slot instead, so the tooltip named a neighbour of the cell under the
 * cursor. Above the floor the bands cannot overlap and a pixel can fall in the
 * gutter between two, where the slot is still the answer to give.
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
 */
export function rowSpanAtY(model: RowGeometry, y0: number, y1: number) {
  return rowSpanAt(y0, y1, rowStackOf(model))
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
