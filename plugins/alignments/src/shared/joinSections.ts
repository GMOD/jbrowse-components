type Columns = Record<string, ArrayLike<unknown>>

type Joined<
  T extends Record<string, Columns>,
  C extends Record<string, unknown>,
> = {
  [K in keyof T]: {
    [P in keyof T[K]]: T[K][P] extends ArrayLike<infer V> ? V[] : never
  } & { [P in keyof C]: C[P][] }
}

/**
 * The parts' tables as one set, each row taking its part's `columns` (its
 * `section`, its `region`) and each `read` column offset to index the joined
 * `reads`. Appends a value at a time: spreading a column into `push`
 * overflows the call stack past ~125k rows.
 */
export function joinSections<
  T extends Record<string, Columns>,
  C extends Record<string, unknown>,
>(parts: { columns: C; tables: T }[], readCount: (tables: T) => number) {
  const joined: Record<string, Record<string, unknown[]>> = {}
  let readOffset = 0
  for (const { columns, tables } of parts) {
    for (const [name, table] of Object.entries(tables)) {
      const out = (joined[name] ??= {})
      let rows = 0
      for (const [column, values] of Object.entries(table)) {
        const into = (out[column] ??= [])
        const offset = column === 'read' ? readOffset : 0
        rows = values.length
        for (let i = 0; i < rows; i++) {
          into.push(offset ? (values[i] as number) + offset : values[i])
        }
      }
      for (const [column, value] of Object.entries(columns)) {
        const into = (out[column] ??= [])
        for (let i = 0; i < rows; i++) {
          into.push(value)
        }
      }
    }
    readOffset += readCount(tables)
  }
  return joined as Joined<T, C>
}
