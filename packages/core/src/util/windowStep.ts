// The `window` step, Vega-Lite's window transform over a group's rows in
// start order. Imported by relative path only.
import { aggregateFieldName } from './aggregateFieldName.ts'
import { numberReaderOf, readerOf, withColumns } from './featureTable.ts'
import { isPlainFieldRef } from './fieldReader.ts'
import {
  groupRows,
  groupedStartOrder,
  isWeighted,
  stepNumberReader,
  stepReader,
} from './stepTables.ts'

import type { Column, FeatureTable } from './featureTable.ts'
import type { AggregateOp, WindowStep } from './markEncodingTypes.ts'
import type { Staged } from './stepTables.ts'

type Frame = NonNullable<WindowStep['frame']>

export const DEFAULT_WINDOW_FRAME: Frame = [-10, 10]

// The rows grouped, groups in the order first met and so sections outermost,
// each group's rows in start order, an unreadable start sorting last; and
// where each group's rows begin.
function windowOrder(
  table: FeatureTable,
  groupOf: Uint32Array,
  groups: number,
) {
  const n = table.length
  const readStart = numberReaderOf(table.column('start'))
  const starts = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const s = readStart(i)
    starts[i] = Number.isNaN(s) ? Infinity : s
  }
  const { order, first } = groupedStartOrder(groupOf, groups, starts)
  return { order, groupStart: first }
}

// The rows `[first, last]` of a group of `m` around its row `j`, empty where
// `first` passes `last`.
function frameAt([before, after]: Frame, j: number, m: number) {
  return [
    before === null ? 0 : Math.max(0, j + before),
    after === null ? m - 1 : Math.min(m - 1, j + after),
  ] as const
}

// A sum, count or mean over each frame from running totals, which answer an
// empty frame exactly 0, since the totals hold one value across it.
function totalsOver(
  op: AggregateOp['op'],
  values: Float64Array,
  weights: Float64Array,
  frame: Frame,
  lo: number,
  hi: number,
  out: Float64Array,
) {
  const m = hi - lo
  const weightTotal = new Float64Array(m + 1)
  const sumTotal = new Float64Array(m + 1)
  for (let j = 0; j < m; j++) {
    const v = values[lo + j]!
    const w = weights[lo + j]!
    const counted = Number.isFinite(v) && Number.isFinite(w)
    weightTotal[j + 1] = weightTotal[j]! + (counted ? w : 0)
    sumTotal[j + 1] = sumTotal[j]! + (counted ? v * w : 0)
  }
  for (let j = 0; j < m; j++) {
    const [a, b] = frameAt(frame, j, m)
    const weight = a > b ? 0 : weightTotal[b + 1]! - weightTotal[a]!
    const sum = a > b ? 0 : sumTotal[b + 1]! - sumTotal[a]!
    out[lo + j] =
      op === 'count'
        ? weight
        : op === 'sum'
          ? sum
          : weight === 0
            ? Number.NaN
            : sum / weight
  }
}

// A min or max over each frame through a monotonic queue of row positions,
// which holds because neither end of a frame ever moves back.
function extremeOver(
  op: 'min' | 'max',
  values: Float64Array,
  frame: Frame,
  lo: number,
  hi: number,
  out: Float64Array,
) {
  const m = hi - lo
  const queue = new Uint32Array(m)
  let head = 0
  let tail = 0
  let added = 0
  for (let j = 0; j < m; j++) {
    const [a, b] = frameAt(frame, j, m)
    for (; added <= b; added++) {
      const v = values[lo + added]!
      if (!Number.isFinite(v)) {
        continue
      }
      while (
        tail > head &&
        (op === 'min'
          ? values[lo + queue[tail - 1]!]! >= v
          : values[lo + queue[tail - 1]!]! <= v)
      ) {
        tail--
      }
      queue[tail++] = added
    }
    while (head < tail && queue[head]! < a) {
      head++
    }
    out[lo + j] = head < tail ? values[lo + queue[head]!]! : Number.NaN
  }
}

function windowColumn(
  table: FeatureTable,
  agg: AggregateOp,
  order: Uint32Array,
  groupStart: Uint32Array,
  frame: Frame,
): Column {
  const { op, field, weight } = agg
  if (op !== 'count' && field === undefined) {
    throw new Error(`a window ${op} needs a field`)
  }
  const n = order.length
  const readValue =
    field === undefined || op === 'count'
      ? () => 0
      : stepNumberReader(table, field, 'a window')
  const readWeight =
    weight !== undefined && isWeighted(agg)
      ? stepNumberReader(table, weight, 'a window')
      : () => 1
  const values = new Float64Array(n)
  const weights = new Float64Array(n)
  for (let k = 0; k < n; k++) {
    values[k] = readValue(order[k]!)
    weights[k] = readWeight(order[k]!)
  }
  const out = new Float64Array(n)
  for (let g = 0; g + 1 < groupStart.length; g++) {
    const lo = groupStart[g]!
    const hi = groupStart[g + 1]!
    if (op === 'min' || op === 'max') {
      extremeOver(op, values, frame, lo, hi, out)
    } else {
      totalsOver(op, values, weights, frame, lo, hi, out)
    }
  }
  return op === 'count' || op === 'sum'
    ? { kind: 'number', values: out, at: undefined }
    : { kind: 'number', values: out, at: undefined, nanIsAbsent: true }
}

export function windowStep(
  { table, bounds }: Staged,
  step: WindowStep,
): Staged {
  const { groupby = [], ops, frame = DEFAULT_WINDOW_FRAME } = step
  const keyed = groupby.some(field => !isPlainFieldRef(field))
  const reads = groupby.map(field =>
    keyed
      ? stepReader(table, field, 'a window')
      : readerOf(table.column(field)),
  )
  const { groupOf, firstRow } = groupRows(table.length, bounds, reads, !keyed)
  const { order, groupStart } = windowOrder(table, groupOf, firstRow.length)
  const written = new Map<string, Column>(
    ops.map(agg => [
      aggregateFieldName(agg),
      windowColumn(table, agg, order, groupStart, frame),
    ]),
  )
  return { table: withColumns(table, written, order), bounds }
}
