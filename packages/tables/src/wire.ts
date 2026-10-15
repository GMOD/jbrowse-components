/**
 * The tables as the bare-host bundle sends them: JSON for their shape and
 * text, and one byte buffer for their numbers, which a host reads without
 * parsing. A column, an array of values, crosses as one of:
 *
 * - `{ $i32: [offset, length] }`: whole numbers an int32 holds, as
 *   little-endian int32 at `offset` in the buffer, null as -2^31 (R's
 *   `NA_integer_`).
 * - `{ $f64: [offset, length] }`: any other numbers, as float64, null and a
 *   non-finite value as R's `NA_real_`.
 * - `{ $lgl: [offset, length] }`: booleans, as int32 0 or 1, null as -2^31.
 * - `{ $dict: { levels, codes } }`: text that repeats, each row the 0-based
 *   index of its value in `levels` (an int32 column), -1 for null.
 * - `{ $list: { lengths, values } }`: a column whose rows are arrays (a
 *   `Number=A` INFO key), each row's length, -1 for a null row, and the rows'
 *   values end to end, each a column itself, so a host never guesses a
 *   matrix from rows that share a length.
 * - a plain JSON array, for text that seldom repeats, a column every row of
 *   which is null, or an empty one.
 *
 * A whole-number column crosses as int32 exactly where JSON would read as
 * integers in R, so a column keeps the type it had when the tables crossed
 * as JSON alone.
 */
export function toWire(value: unknown) {
  const bytes = new ByteSink()
  const json = JSON.stringify(encode(value, bytes))
  return { json, bytes: bytes.concat() }
}

const NA_INT = -(2 ** 31)
const INT_MAX = 2 ** 31 - 1
// R's NA_real_: a NaN whose low word is 1954
const NA_REAL_LOW = 1954
const NA_REAL_HIGH = 0x7ff00000

class ByteSink {
  private chunks: Uint8Array[] = []
  private size = 0

  add(view: Int32Array | Float64Array) {
    const offset = this.size
    this.chunks.push(
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
    )
    this.size += view.byteLength
    return [offset, view.length]
  }

  concat() {
    const out = new Uint8Array(this.size)
    let at = 0
    for (const chunk of this.chunks) {
      out.set(chunk, at)
      at += chunk.length
    }
    return out
  }
}

function encode(value: unknown, bytes: ByteSink): unknown {
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return column(Array.from(value as unknown as ArrayLike<number>), bytes)
  }
  if (Array.isArray(value)) {
    return column(value, bytes)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, encode(v, bytes)]),
    )
  }
  return value
}

const isNull = (v: unknown): v is null | undefined =>
  v === null || v === undefined

function isRow(v: unknown): v is ArrayLike<unknown> {
  return Array.isArray(v) || ArrayBuffer.isView(v)
}

type Kind = 'none' | 'number' | 'boolean' | 'string' | 'row' | 'other'

function kindOfValue(v: unknown): Kind {
  if (isNull(v)) {
    return 'none'
  }
  if (isRow(v)) {
    return 'row'
  }
  const type = typeof v
  return type === 'number' || type === 'boolean' || type === 'string'
    ? type
    : 'other'
}

function kindOf(values: readonly unknown[]) {
  let kind: Kind = 'none'
  for (const v of values) {
    const k = kindOfValue(v)
    if (k !== 'none') {
      if (kind !== 'none' && kind !== k) {
        return 'other'
      }
      kind = k
    }
  }
  return kind
}

function column(values: readonly unknown[], bytes: ByteSink): unknown {
  switch (kindOf(values)) {
    case 'number': {
      return numbers(values as (number | null)[], bytes)
    }
    case 'boolean': {
      return {
        $lgl: bytes.add(
          Int32Array.from(values, v =>
            isNull(v) ? NA_INT : v === true ? 1 : 0,
          ),
        ),
      }
    }
    case 'string': {
      return strings(values as (string | null)[], bytes)
    }
    case 'row': {
      return nested(values, bytes)
    }
    default: {
      return values.map(v => encode(v, bytes))
    }
  }
}

function numbers(values: readonly (number | null)[], bytes: ByteSink) {
  const whole = values.every(
    v => isNull(v) || (Number.isInteger(v) && Math.abs(v) <= INT_MAX),
  )
  if (whole) {
    return {
      $i32: bytes.add(Int32Array.from(values, v => (isNull(v) ? NA_INT : v))),
    }
  }
  const out = new Float64Array(values.length)
  const words = new Uint32Array(out.buffer, out.byteOffset, out.length * 2)
  values.forEach((v, i) => {
    if (isNull(v) || !Number.isFinite(v)) {
      words[2 * i] = NA_REAL_LOW
      words[2 * i + 1] = NA_REAL_HIGH
    } else {
      out[i] = v
    }
  })
  return { $f64: bytes.add(out) }
}

// Text crosses as codes where its values repeat at least twice on average, so
// a column of a few colors or types costs four bytes a row, and stays JSON
// where each value is its own, as read names are.
function strings(values: readonly (string | null)[], bytes: ByteSink) {
  const index = new Map<string, number>()
  const codes = new Int32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (isNull(v)) {
      codes[i] = -1
    } else {
      let code = index.get(v)
      if (code === undefined) {
        code = index.size
        index.set(v, code)
        if (index.size * 2 > values.length) {
          return values
        }
      }
      codes[i] = code
    }
  }
  return {
    $dict: { levels: [...index.keys()], codes: { $i32: bytes.add(codes) } },
  }
}

function nested(rows: readonly unknown[], bytes: ByteSink) {
  const lengths: number[] = []
  const values: unknown[] = []
  for (const row of rows) {
    if (isRow(row)) {
      lengths.push(row.length)
      for (let i = 0; i < row.length; i++) {
        values.push(row[i] ?? null)
      }
    } else {
      lengths.push(-1)
    }
  }
  return {
    $list: { lengths: column(lengths, bytes), values: column(values, bytes) },
  }
}

/**
 * The tables `toWire` sent, read back as a host reads them: each column an
 * array, null where the wire wrote NA. For a JavaScript host, and the tests.
 */
export function fromWire(value: unknown, bytes: Uint8Array): unknown {
  if (Array.isArray(value)) {
    return value.map(v => fromWire(v, bytes))
  }
  if (value && typeof value === 'object') {
    const [key, spec] = Object.entries(value)[0] ?? []
    const at = spec as [number, number]
    switch (key) {
      case '$i32':
      case '$lgl': {
        const slice = bytes.slice(at[0], at[0] + at[1] * 4)
        const ints = Array.from(
          new Int32Array(slice.buffer, slice.byteOffset, at[1]),
        )
        return ints.map(v =>
          v === NA_INT ? null : key === '$lgl' ? v === 1 : v,
        )
      }
      case '$f64': {
        const slice = bytes.slice(at[0], at[0] + at[1] * 8)
        const words = new Uint32Array(slice.buffer, slice.byteOffset, at[1] * 2)
        const doubles = new Float64Array(slice.buffer, slice.byteOffset, at[1])
        return Array.from(doubles, (v, i) =>
          words[2 * i] === NA_REAL_LOW && words[2 * i + 1] === NA_REAL_HIGH
            ? null
            : v,
        )
      }
      case '$dict': {
        const { levels, codes } = spec as { levels: string[]; codes: unknown }
        return (fromWire(codes, bytes) as number[]).map(c =>
          c < 0 ? null : levels[c],
        )
      }
      case '$list': {
        const { lengths, values } = spec as {
          lengths: unknown
          values: unknown
        }
        const flat = fromWire(values, bytes) as unknown[]
        let start = 0
        return (fromWire(lengths, bytes) as number[]).map(n => {
          if (n < 0) {
            return null
          }
          start += n
          return flat.slice(start - n, start)
        })
      }
      default: {
        return Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, fromWire(v, bytes)]),
        )
      }
    }
  }
  return value
}
