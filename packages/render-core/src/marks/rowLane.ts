import { HIDDEN_ROW, NO_ROW_COLOR } from './rowTable.ts'

import type { RowTable } from './rowTable.ts'

/**
 * The `row` lane a value shape may carry: which band an instance stands in,
 * `rowHeight` px each, the value scale ruling every band on its own. A caller
 * that declares no rows is on row 0 with the whole canvas for a band, which is
 * the same arithmetic, so the shaders take the lane unconditionally.
 */
export interface RowChannel {
  row?: Uint32Array
}

export interface RowParams {
  /** CSS px per row band; the canvas height when absent. */
  rowHeight?: number
  /** CSS px every row's band starts below the canvas top, less a scroll; 0 when absent. */
  rowOffsetPx?: number
  /**
   * The table `row` is read through as a key: its drawn slot, hidden, or a
   * color override. Absent, `row` is the slot.
   */
  rowTable?: RowTable
}

const NO_ROWS = new Uint32Array(0)

/** The lane the instance buffer packs: zeros where the caller sent none. */
export function rowLane(row: Uint32Array | undefined, count: number) {
  return row ?? (count === 0 ? NO_ROWS : new Uint32Array(count))
}

/**
 * The `rowTableKeys` uniform: the table's key count, or -1 with none bound,
 * which a shader reads as each `row` being its own slot.
 */
export function rowTableKeys({ rowTable }: Pick<RowParams, 'rowTable'>) {
  return rowTable ? rowTable.keys : -1
}

/** What a pass reading the table binds. */
export function rowTableTextures({ rowTable }: Pick<RowParams, 'rowTable'>) {
  return { rowTable: rowTable?.texture }
}

export function bandHeightPx(params: RowParams, canvasHeight: number) {
  return params.rowHeight ?? canvasHeight
}

function rowKey(row: Uint32Array | undefined, i: number) {
  return row === undefined ? 0 : row[i]!
}

/** The slot `key` is drawn on, undefined where the table hides it. */
export function keySlot(key: number, table: RowTable | undefined) {
  if (!table) {
    return key
  }
  const slot = key < table.keys ? table.slot[key]! : HIDDEN_ROW
  return slot === HIDDEN_ROW ? undefined : slot
}

/** The slot instance `i` is drawn on, undefined where the table hides its key. */
export function rowSlot(
  row: Uint32Array | undefined,
  i: number,
  table: RowTable | undefined,
) {
  return keySlot(rowKey(row, i), table)
}

/** Instance `i`'s key's color override, undefined where it keeps its own. */
export function rowColorOverride(
  row: Uint32Array | undefined,
  i: number,
  table: RowTable | undefined,
) {
  const key = rowKey(row, i)
  const override = table && key < table.keys ? table.color[key]! : NO_ROW_COLOR
  return override >>> 24 === 0 ? undefined : override
}

/** The color instance `i` is drawn in: its key's override, else `color`. */
export function rowColor(
  color: number,
  row: Uint32Array | undefined,
  i: number,
  table: RowTable | undefined,
) {
  return rowColorOverride(row, i, table) ?? color
}
