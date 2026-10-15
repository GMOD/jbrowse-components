/**
 * The tables as the bare-host bundle sends them: JSON, every typed array
 * written as a plain array, and every nested column (a column whose rows are
 * arrays, such as a `Number=A` INFO key) written as `{ $list: { lengths,
 * values } }`: each row's length, -1 for a null row, and the rows' values end
 * to end. A host builds its list column from that alone, so no JSON reader
 * guesses a matrix from rows that happen to share a length.
 */
export function toWire(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }
  if (Array.isArray(value)) {
    return isNested(value) ? nestedColumn(value) : value.map(toWire)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toWire(v)]),
    )
  }
  return value
}

function isRow(v: unknown): v is ArrayLike<unknown> {
  return Array.isArray(v) || ArrayBuffer.isView(v)
}

function isNested(column: readonly unknown[]) {
  let nested = false
  for (const v of column) {
    if (isRow(v)) {
      nested = true
    } else if (v !== null && v !== undefined) {
      return false
    }
  }
  return nested
}

function nestedColumn(column: readonly unknown[]) {
  const lengths: number[] = []
  const values: unknown[] = []
  for (const row of column) {
    if (isRow(row)) {
      lengths.push(row.length)
      for (let i = 0; i < row.length; i++) {
        values.push(row[i] ?? null)
      }
    } else {
      lengths.push(-1)
    }
  }
  return { $list: { lengths, values } }
}

/** The tables `toWire` sent, its nested columns as arrays again. */
export function fromWire(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(fromWire)
  }
  if (value && typeof value === 'object') {
    const list = (value as { $list?: { lengths: number[]; values: unknown[] } })
      .$list
    if (list) {
      let at = 0
      return list.lengths.map(n => {
        if (n < 0) {
          return null
        }
        at += n
        return list.values.slice(at - n, at)
      })
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fromWire(v)]),
    )
  }
  return value
}
