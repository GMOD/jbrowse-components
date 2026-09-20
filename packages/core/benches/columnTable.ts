// A struct-of-arrays feature table, an encoder that reads it into the same
// `EncodedChannels` `encodeFeatures` emits, three of the transform steps as
// index-array kernels, and one reusable row cursor implementing `Feature` so a
// `jexl:` channel evaluates without a `SimpleFeature`.
//
// A SPIKE, and bench-only: it lives beside `columnEncode.bench.ts` rather than
// under `src/`, is in no `exports` map and nothing but that bench imports it.
// It exists to be timed against the Feature-typed path, so it implements the
// channels and steps the bench times and throws on the rest — a lane it cannot
// fill would otherwise be a silently missing output, which is the one thing an
// identity check cannot catch.
//
// `argsortByStart` packs the start and the index into one double and sorts that
// without a comparator, which is exact while `max(start) * n + n` stays under
// 2^53 and is stable because ties break on the index. `%TypedArray%.sort` with
// a comparator, which `argsortByStartComparator` is, leaves the fast path
// entirely, and the bench times both so the choice is visible rather than
// baked in.
//
// The verdict it was built for: agent-docs/ideas/closed/column-encoder-verdict.md.
import { cssColorToABGR } from '../src/util/colorBits.ts'
import { isJexl, stringToJexlExpression } from '../src/util/jexlStrings.ts'
import { hitIndexOf } from '../src/util/markEncoding.ts'
import { jexlFeatureProxy } from '../src/util/simpleFeature.ts'

import type { JexlInstance } from '../src/util/jexlStrings.ts'
import type {
  EncodedChannels,
  LaneName,
} from '../src/util/markEncodingTypes.ts'
import type {
  Feature,
  SimpleFeatureSerialized,
} from '../src/util/simpleFeature.ts'

export type NumericColumn =
  | Float64Array
  | Float32Array
  | Int32Array
  | Uint32Array

export type ColumnValues = NumericColumn | string[]

export interface ColumnTable {
  length: number
  columns: Record<string, ColumnValues>
}

export interface ColumnEncoding {
  x?: string
  x2?: string
  y?: string
  row?: string
  color?: string
}

export interface ColumnEncodeContext {
  jexl?: JexlInstance
}

export class RowCursor implements Feature {
  index = 0

  private readonly table: ColumnTable

  constructor(table: ColumnTable) {
    this.table = table
  }

  get = ((name: string) =>
    this.table.columns[name]?.[this.index]) as Feature['get']

  id() {
    return `row${this.index}`
  }

  toJSON(): SimpleFeatureSerialized {
    const out: Record<string, unknown> = { uniqueId: this.id() }
    for (const [name, column] of Object.entries(this.table.columns)) {
      out[name] = column[this.index]
    }
    return out as SimpleFeatureSerialized
  }
}

function numericColumn(table: ColumnTable, name: string): NumericColumn {
  const column = table.columns[name]
  if (column === undefined) {
    throw new Error(`the table has no column "${name}"`)
  }
  if (Array.isArray(column)) {
    throw new Error(`column "${name}" is a string column, not a numeric one`)
  }
  return column
}

function isFloatColumn(column: NumericColumn) {
  return column instanceof Float64Array || column instanceof Float32Array
}

function asU32(column: NumericColumn, n: number) {
  if (column instanceof Uint32Array) {
    return column.length === n ? column : column.subarray(0, n)
  }
  if (column instanceof Int32Array) {
    return new Uint32Array(column.buffer, column.byteOffset, n)
  }
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = column[i]!
  }
  return out
}

function asF32(column: NumericColumn, n: number) {
  if (column instanceof Float32Array) {
    return column.length === n ? column : column.subarray(0, n)
  }
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = column[i]!
  }
  return out
}

function countUnplaceable(
  x: NumericColumn,
  x2: NumericColumn,
  y: NumericColumn | undefined,
  n: number,
) {
  const columns = [x, x2, y].filter(
    c => c !== undefined && isFloatColumn(c),
  ) as NumericColumn[]
  if (columns.length === 0) {
    return 0
  }
  let bad = 0
  for (let i = 0; i < n; i++) {
    for (const column of columns) {
      if (!Number.isFinite(column[i]!)) {
        bad++
        break
      }
    }
  }
  return bad
}

function colorReader(color: string, jexl: JexlInstance | undefined) {
  if (!isJexl(color)) {
    const constant = cssColorToABGR(color)
    return { constant, read: undefined }
  }
  if (!jexl) {
    throw new Error(`a jexl: channel needs a jexl instance (${color})`)
  }
  const expression = stringToJexlExpression(color, jexl)
  const packed = new Map<string, number>()
  return {
    constant: undefined,
    read: (context: Record<string, unknown>) => {
      const value = expression.eval(context)
      if (typeof value !== 'string') {
        return cssColorToABGR('#808080')
      }
      let abgr = packed.get(value)
      if (abgr === undefined) {
        abgr = cssColorToABGR(value)
        packed.set(value, abgr)
      }
      return abgr
    },
  }
}

export function encodeColumns(
  table: ColumnTable,
  encoding: ColumnEncoding,
  lanes: readonly LaneName[],
  ctx: ColumnEncodeContext = {},
): EncodedChannels {
  const n = table.length
  const has = (lane: LaneName) => lanes.includes(lane)
  for (const lane of lanes) {
    if (lane === 'colorValue' || lane === 'glyph') {
      throw new Error(`the column spike fills no "${lane}" lane`)
    }
  }
  const xColumn = numericColumn(table, encoding.x ?? 'start')
  const x2Column = numericColumn(table, encoding.x2 ?? 'end')
  const yColumn =
    has('y') && encoding.y !== undefined
      ? numericColumn(table, encoding.y)
      : undefined
  const rowColumn =
    has('row') && encoding.row !== undefined
      ? numericColumn(table, encoding.row)
      : undefined
  const { constant, read } = colorReader(encoding.color ?? '#0068d1', ctx.jexl)
  const cursor = read ? new RowCursor(table) : undefined
  const context = cursor ? { feature: jexlFeatureProxy(cursor) } : undefined
  const unplaceable = countUnplaceable(xColumn, x2Column, yColumn, n)

  let count = n
  let x: Uint32Array
  let x2: Uint32Array
  let y: Float32Array | undefined
  let row: Uint32Array | undefined
  let featureIndex: Uint32Array
  let color: Uint32Array | undefined
  if (unplaceable === 0) {
    x = asU32(xColumn, n)
    x2 = asU32(x2Column, n)
    y = yColumn ? asF32(yColumn, n) : has('y') ? new Float32Array(n) : undefined
    row = rowColumn
      ? asU32(rowColumn, n)
      : has('row')
        ? new Uint32Array(n)
        : undefined
    featureIndex = new Uint32Array(n)
    for (let i = 0; i < n; i++) {
      featureIndex[i] = i
    }
    if (has('color')) {
      color = new Uint32Array(n)
      if (read && cursor && context) {
        for (let i = 0; i < n; i++) {
          cursor.index = i
          color[i] = read(context)
        }
      } else {
        color.fill(constant!)
      }
    }
  } else {
    const xs = new Uint32Array(n)
    const x2s = new Uint32Array(n)
    const ys = has('y') ? new Float32Array(n) : undefined
    const rows = has('row') ? new Uint32Array(n) : undefined
    const colors = has('color') ? new Uint32Array(n) : undefined
    featureIndex = new Uint32Array(n)
    count = 0
    for (let i = 0; i < n; i++) {
      const xv = xColumn[i]!
      const x2v = x2Column[i]!
      const yv = yColumn ? yColumn[i]! : 0
      if (
        !Number.isFinite(xv) ||
        !Number.isFinite(x2v) ||
        !Number.isFinite(yv)
      ) {
        continue
      }
      xs[count] = xv
      x2s[count] = x2v
      if (ys) {
        ys[count] = yv
      }
      if (rows) {
        rows[count] = rowColumn ? Math.max(0, rowColumn[i]!) : 0
      }
      if (colors) {
        if (read && cursor && context) {
          cursor.index = i
          colors[count] = read(context)
        } else {
          colors[count] = constant!
        }
      }
      featureIndex[count] = i
      count++
    }
    x = xs.subarray(0, count)
    x2 = x2s.subarray(0, count)
    y = ys?.subarray(0, count)
    row = rows?.subarray(0, count)
    color = colors?.subarray(0, count)
    featureIndex = featureIndex.subarray(0, count)
  }

  let yMin = Infinity
  let yMax = -Infinity
  if (yColumn && y) {
    for (let i = 0; i < count; i++) {
      const v = y[i]!
      if (v < yMin) {
        yMin = v
      }
      if (v > yMax) {
        yMax = v
      }
    }
  }

  const encoded: EncodedChannels = {
    count,
    skipped: n - count,
    x,
    x2,
    featureIndex,
    yMin,
    yMax,
  }
  if (y) {
    encoded.y = y
  }
  if (row) {
    encoded.row = row
  }
  if (color) {
    encoded.color = color
  }
  if (has('index') && count > 0) {
    encoded.flatbushData = hitIndexOf(x, x2, y, count).data
  }
  return encoded
}

export function argsortByStart(starts: NumericColumn, n: number) {
  const keys = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    keys[i] = starts[i]! * n + i
  }
  keys.sort()
  const order = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    order[i] = keys[i]! % n
  }
  return order
}

export function argsortByStartComparator(starts: NumericColumn, n: number) {
  const order = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    order[i] = i
  }
  order.sort((a, b) => starts[a]! - starts[b]!)
  return order
}

export function stackRows(
  order: Uint32Array,
  starts: NumericColumn,
  ends: NumericColumn,
  padding = 0,
) {
  const n = order.length
  const rows = new Uint16Array(n)
  const rowEnds: number[] = []
  for (let k = 0; k < n; k++) {
    const i = order[k]!
    const start = starts[i]!
    const end = ends[i]!
    let row = 0
    while (row < rowEnds.length && rowEnds[row]! > start) {
      row++
    }
    rowEnds[row] = (end > start ? end : start) + padding
    rows[k] = row
  }
  return rows
}

export function binCountColumns(
  table: ColumnTable,
  step: number,
  field = 'start',
): ColumnTable {
  const values = numericColumn(table, field)
  const n = table.length
  const groups = new Map<number, number>()
  const starts: number[] = []
  const counts: number[] = []
  for (let i = 0; i < n; i++) {
    const binStart = Math.floor(values[i]! / step) * step
    const at = groups.get(binStart)
    if (at === undefined) {
      groups.set(binStart, starts.length)
      starts.push(binStart)
      counts.push(1)
    } else {
      counts[at]!++
    }
  }
  const length = starts.length
  const outStart = new Uint32Array(length)
  const outEnd = new Uint32Array(length)
  const outCount = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    outStart[i] = starts[i]!
    outEnd[i] = starts[i]! + step
    outCount[i] = counts[i]!
  }
  return {
    length,
    columns: { start: outStart, end: outEnd, count: outCount },
  }
}

export function coverageColumns(
  table: ColumnTable,
  as = 'coverage',
): ColumnTable {
  const n = table.length
  if (n === 0) {
    return {
      length: 0,
      columns: {
        start: new Uint32Array(0),
        end: new Uint32Array(0),
        [as]: new Float32Array(0),
      },
    }
  }
  const startColumn = numericColumn(table, 'start')
  const endColumn = numericColumn(table, 'end')
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = startColumn[i]!
    ends[i] = endColumn[i]!
  }
  starts.sort()
  ends.sort()
  const outStart = new Uint32Array(2 * n)
  const outEnd = new Uint32Array(2 * n)
  const outDepth = new Float32Array(2 * n)
  let out = 0
  let depth = 0
  let runStart = starts[0]!
  let si = 0
  let ei = 0
  while (si < n || ei < n) {
    const nextStart = si < n ? starts[si]! : Infinity
    const nextEnd = ei < n ? ends[ei]! : Infinity
    const at = Math.min(nextStart, nextEnd)
    if (depth > 0 && at > runStart) {
      outStart[out] = runStart
      outEnd[out] = at
      outDepth[out] = depth
      out++
    }
    runStart = at
    while (si < n && starts[si] === at) {
      depth++
      si++
    }
    while (ei < n && ends[ei] === at) {
      depth--
      ei++
    }
  }
  return {
    length: out,
    columns: {
      start: outStart.subarray(0, out),
      end: outEnd.subarray(0, out),
      [as]: outDepth.subarray(0, out),
    },
  }
}
