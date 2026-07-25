import type { MafHover } from '../util.ts'
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
    gposFrac: number,
    rowIndex: number,
    bpPerPx: number,
  ) => MafHover | undefined
}

/** The cursor projected into the display's coordinate systems. */
export interface MafPointer {
  pos: PxToBpResult
  /** absolute fractional genomic coordinate, orientation-aware */
  gposFrac: number
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
    rowIndex: Math.floor(rowAtY(model, mouseY)),
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

/**
 * The row hover (aligned base / insertion / deletion / bridged region) under
 * the cursor. Undefined over the bands, out of bounds, or where no fetched
 * block covers the row.
 */
export function resolveMafRowHover(
  model: MafHitTestModel,
  mouseX: number,
  mouseY: number,
): MafHover | undefined {
  const { pos, gposFrac, rowIndex, inBands } = mafPointerAt(
    model,
    mouseX,
    mouseY,
  )
  return pos.oob || inBands
    ? undefined
    : model.rowHoverInfo(pos.index, gposFrac, rowIndex, model.lgv.bpPerPx)
}
