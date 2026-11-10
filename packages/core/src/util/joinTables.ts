type Columns = Record<string, ArrayLike<unknown>>

type Joined<
  T extends Record<string, Columns>,
  C extends Record<string, unknown>,
> = {
  [K in keyof T]: {
    [P in keyof T[K]]: T[K][P] extends ArrayLike<infer V> ? V[] : never
  } & { [P in keyof C]: C[P][] }
}

function rowCount(table: Columns) {
  return Object.values(table)[0]?.length ?? 0
}

/**
 * The parts' tables as one set, each row taking its part's `columns` (its
 * `section`, its `region`), and each column `indexes` names (`read`, naming
 * a row of `reads`) offset to index the joined table it names; a negative
 * index, naming no row, stays as it is. A part's `keep` leaves out the rows
 * of a table it rejects, with every row of another table whose index names
 * one. Appends a value at a time: spreading a column into `push` overflows
 * the call stack past ~125k rows.
 */
export function joinTables<
  T extends Record<string, Columns>,
  C extends Record<string, unknown>,
>(
  parts: readonly {
    columns: C
    tables: T
    keep?: Readonly<Record<string, (row: number) => boolean>>
  }[],
  indexes: Readonly<Record<string, string>> = {},
) {
  const joined: Record<string, Record<string, unknown[]>> = {}
  const offsets = new Map<string, number>()
  for (const { columns, tables, keep } of parts) {
    const kept = new Map<string, number[]>()
    for (const [name, table] of Object.entries(tables)) {
      const keepRow = keep?.[name]
      let n = 0
      kept.set(
        name,
        Array.from({ length: rowCount(table) }, (_, row) =>
          !keepRow || keepRow(row) ? n++ : -1,
        ),
      )
    }
    const indexOf = (column: string, value: unknown) => {
      const target = indexes[column]
      return target === undefined || typeof value !== 'number' || value < 0
        ? value
        : (kept.get(target)?.[value] ?? value) + (offsets.get(target) ?? 0)
    }
    const namesKeptRow = (column: string, value: unknown) => {
      const target = indexes[column]
      return (
        target === undefined ||
        typeof value !== 'number' ||
        value < 0 ||
        (kept.get(target)?.[value] ?? 0) >= 0
      )
    }
    for (const [name, table] of Object.entries(tables)) {
      const out = (joined[name] ??= {})
      const entries = Object.entries(table)
      const keptRows = kept
        .get(name)!
        .flatMap((k, row) =>
          k >= 0 &&
          entries.every(([column, values]) => namesKeptRow(column, values[row]))
            ? [row]
            : [],
        )
      for (const [column, values] of entries) {
        const into = (out[column] ??= [])
        for (const row of keptRows) {
          into.push(indexOf(column, values[row]))
        }
      }
      for (const [column, value] of Object.entries(columns)) {
        const into = (out[column] ??= [])
        for (const _ of keptRows) {
          into.push(value)
        }
      }
    }
    for (const [name, rows] of kept) {
      offsets.set(
        name,
        (offsets.get(name) ?? 0) + rows.filter(k => k >= 0).length,
      )
    }
  }
  return joined as Joined<T, C>
}
