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
 * Each of a part's reads' index among the reads `keepRead` keeps, -1 for one
 * it leaves out.
 */
function keptReadIndices(count: number, keepRead: (read: number) => boolean) {
  let kept = 0
  return Array.from({ length: count }, (_, read) =>
    keepRead(read) ? kept++ : -1,
  )
}

/**
 * The parts' tables as one set, each row taking its part's `columns` (its
 * `section`, its `region`) and each `read` column offset to index the joined
 * `reads`. A part's `keepRead` leaves out the `reads` rows it rejects, with
 * every row of another table whose `read` names one. Appends a value at a
 * time: spreading a column into `push` overflows the call stack past ~125k
 * rows.
 */
export function joinSections<
  T extends Record<string, Columns>,
  C extends Record<string, unknown>,
>(
  parts: {
    columns: C
    tables: T
    keepRead?: (read: number) => boolean
  }[],
  readCount: (tables: T) => number,
) {
  const joined: Record<string, Record<string, unknown[]>> = {}
  let readOffset = 0
  for (const { columns, tables, keepRead } of parts) {
    const count = readCount(tables)
    const kept = keepRead && keptReadIndices(count, keepRead)
    const indexOf = (read: number) => (kept ? kept[read]! : read)
    for (const [name, table] of Object.entries(tables)) {
      const out = (joined[name] ??= {})
      const readOf = name === 'reads' ? undefined : table.read
      const rows = Object.values(table)[0]?.length ?? 0
      const keptRows = Array.from({ length: rows }, (_, i) => i).filter(i =>
        name === 'reads'
          ? indexOf(i) >= 0
          : readOf
            ? indexOf(readOf[i] as number) >= 0
            : true,
      )
      for (const [column, values] of Object.entries(table)) {
        const into = (out[column] ??= [])
        for (const i of keptRows) {
          into.push(
            column === 'read'
              ? indexOf(values[i] as number) + readOffset
              : values[i],
          )
        }
      }
      for (const [column, value] of Object.entries(columns)) {
        const into = (out[column] ??= [])
        for (const _ of keptRows) {
          into.push(value)
        }
      }
    }
    readOffset += kept ? kept.filter(k => k >= 0).length : count
  }
  return joined as Joined<T, C>
}
