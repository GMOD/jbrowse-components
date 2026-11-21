/** Whether a span, its ends in either order, reaches into `window`. */
export function spanTouches(
  window: { start: number; end: number },
  a: number,
  b: number,
) {
  return Math.max(a, b) > window.start && Math.min(a, b) < window.end
}

/** A table's rows whose `position` passes `keep`. */
export function rowsWhere<
  T extends Record<string, ArrayLike<unknown>> & {
    position: ArrayLike<number>
  },
>(table: T, keep: (position: number) => boolean) {
  return rowsAt(table, i => keep(table.position[i]!))
}

/** A table's rows whose index passes `keep`. */
export function rowsAt<T extends Record<string, ArrayLike<unknown>>>(
  table: T,
  keep: (row: number) => boolean,
) {
  const length = Math.max(0, ...Object.values(table).map(c => c.length))
  const rows = Array.from({ length }, (_, i) => i).filter(keep)
  return Object.fromEntries(
    Object.entries(table).map(([name, column]) => [
      name,
      rows.map(i => column[i]),
    ]),
  ) as { [K in keyof T]: T[K] extends ArrayLike<infer V> ? V[] : never }
}
