type Columns = Record<string, ArrayLike<unknown>>

type Joined<T extends Record<string, Columns>> = {
  [K in keyof T]: {
    [C in keyof T[K]]: T[K][C] extends ArrayLike<infer V> ? V[] : never
  } & { section: string[] }
}

/**
 * The sections' tables as one set, each row naming its `section` and each
 * `read` column offset to index the joined `reads`. Appends a value at a time:
 * spreading a column into `push` overflows the call stack past ~125k rows.
 */
export function joinSections<T extends Record<string, Columns>>(
  sections: { label: string; tables: T }[],
  readCount: (tables: T) => number,
) {
  const joined: Record<string, Record<string, unknown[]>> = {}
  let readOffset = 0
  for (const { label, tables } of sections) {
    for (const [name, table] of Object.entries(tables)) {
      const out = (joined[name] ??= { section: [] })
      let rows = 0
      for (const [column, values] of Object.entries(table)) {
        const into = (out[column] ??= [])
        const offset = column === 'read' ? readOffset : 0
        rows = values.length
        for (let i = 0; i < rows; i++) {
          into.push(offset ? (values[i] as number) + offset : values[i])
        }
      }
      const section = out.section!
      for (let i = 0; i < rows; i++) {
        section.push(label)
      }
    }
    readOffset += readCount(tables)
  }
  return joined as Joined<T>
}
