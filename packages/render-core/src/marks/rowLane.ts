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
}

const NO_ROWS = new Uint32Array(0)

/** The lane the instance buffer packs: zeros where the caller sent none. */
export function rowLane(row: Uint32Array | undefined, count: number) {
  return row ?? (count === 0 ? NO_ROWS : new Uint32Array(count))
}

export function bandHeightPx(params: RowParams, canvasHeight: number) {
  return params.rowHeight ?? canvasHeight
}

export function bandTopPx(
  row: Uint32Array | undefined,
  i: number,
  band: number,
) {
  return row === undefined ? 0 : band * row[i]!
}
