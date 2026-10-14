// A path layer's rows in series order. `layerFeatures` applies it, so the
// table `CoreGetEncodedFeature` reads is the one `CoreGetEncodedLayers`
// encoded and an instance's index names the same row in both. Imported by
// relative path only.
import { numberReaderOf, readerOf, selectRows } from './featureTable.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import { groupKey, sortByStart } from './stepTables.ts'
import { DEFAULT_WINDOW_FRAME } from './windowStep.ts'

import type { FeatureTable } from './featureTable.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type { FieldRef, PathSpec, TransformStep } from './markEncodingTypes.ts'

type RowEncoding = FieldRef | ArrayLike<number> | undefined

function reader(table: FeatureTable, ref: FieldRef, jexl?: JexlInstance) {
  if (isPlainFieldRef(ref)) {
    return readerOf(table.column(ref))
  }
  const read = fieldReader(ref, jexl)
  return (i: number) => read(table.row(i))
}

// Each row's series, numbered in the order met: one per distinct pair of the
// row it stands in and its `by` value.
function seriesOf(
  table: FeatureTable,
  row: RowEncoding,
  by: FieldRef | undefined,
  jexl?: JexlInstance,
) {
  const n = table.length
  const readRow =
    typeof row === 'string'
      ? reader(table, row, jexl)
      : row
        ? (i: number) => row[i]
        : () => 0
  const readBy = by === undefined ? () => undefined : reader(table, by, jexl)
  const keys = new Map<unknown, Map<unknown, number>>()
  const series = new Uint32Array(n)
  let count = 0
  for (let i = 0; i < n; i++) {
    const r = readRow(i)
    let byRow = keys.get(r)
    if (!byRow) {
      byRow = new Map()
      keys.set(r, byRow)
    }
    const key = groupKey(readBy(i))
    let s = byRow.get(key)
    if (s === undefined) {
      s = count++
      byRow.set(key, s)
    }
    series[i] = s
  }
  return { series, count }
}

// The rows grouped by series, each series in start order, and where each
// series begins.
function seriesOrder(starts: Float64Array, series: Uint32Array, count: number) {
  const n = series.length
  const first = new Uint32Array(count + 1)
  for (let i = 0; i < n; i++) {
    first[series[i]! + 1]!++
  }
  for (let s = 0; s < count; s++) {
    first[s + 1]! += first[s]!
  }
  const order = new Uint32Array(n)
  const next = first.slice(0, count)
  for (let i = 0; i < n; i++) {
    order[next[series[i]!]!++] = i
  }
  for (let s = 0; s < count; s++) {
    const rows = order.subarray(first[s], first[s + 1])
    let sorted = true
    for (let k = 1; k < rows.length && sorted; k++) {
      sorted = starts[rows[k]!]! >= starts[rows[k - 1]!]!
    }
    if (!sorted) {
      sortByStart(rows, starts)
    }
  }
  return { order, first }
}

// The bases a window's frame spans at the median row: each row's frame runs
// from the start `before` rows back to the start `after` rows on, cut at its
// series' ends, as the window step cut it.
function frameSpanBp(
  starts: Float64Array,
  order: Uint32Array,
  first: Uint32Array,
  [before, after]: [number, number],
) {
  const spans: number[] = []
  for (let s = 0; s + 1 < first.length; s++) {
    const lo = first[s]!
    const m = first[s + 1]! - lo
    for (let j = 0; j < m; j++) {
      const a = Math.max(0, j + before)
      const b = Math.min(m - 1, j + after)
      if (a <= b) {
        spans.push(starts[order[lo + b]!]! - starts[order[lo + a]!]!)
      }
    }
  }
  if (spans.length === 0) {
    return undefined
  }
  spans.sort((x, y) => x - y)
  return spans[spans.length >> 1]
}

function windowFrame(steps: readonly TransformStep[]) {
  const step = steps.findLast(s => s.type === 'window')
  if (step?.type !== 'window') {
    return undefined
  }
  const [before, after] = step.frame ?? DEFAULT_WINDOW_FRAME
  return before === null || after === null
    ? undefined
    : ([before, after] as [number, number])
}

/**
 * #api
 * A path layer's table in series order, as {@link PathSpec} defines a series,
 * with each row's series beside it and the stretch past which a series breaks.
 * `steps` are every step the layer's rows went through, which a `window` among
 * them reads the default break from.
 */
export function pathSeries(
  table: FeatureTable,
  row: RowEncoding,
  path: PathSpec,
  steps: readonly TransformStep[],
  jexl?: JexlInstance,
) {
  const n = table.length
  const { series, count } = seriesOf(table, row, path.by, jexl)
  const readStart = numberReaderOf(table.column('start'))
  const starts = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const s = readStart(i)
    starts[i] = Number.isNaN(s) ? Infinity : s
  }
  const { order, first } = seriesOrder(starts, series, count)
  const ordered = new Uint32Array(n)
  for (let k = 0; k < n; k++) {
    ordered[k] = series[order[k]!]!
  }
  let rowOut: RowEncoding = row
  if (row !== undefined && typeof row !== 'string') {
    const permuted = new Uint32Array(n)
    for (let k = 0; k < n; k++) {
      permuted[k] = row[order[k]!]!
    }
    rowOut = permuted
  }
  const frame = path.gapBp === undefined ? windowFrame(steps) : undefined
  return {
    table: selectRows(table, order),
    row: rowOut,
    series: ordered,
    gapBp:
      path.gapBp ??
      (frame ? frameSpanBp(starts, order, first, frame) : undefined),
  }
}
