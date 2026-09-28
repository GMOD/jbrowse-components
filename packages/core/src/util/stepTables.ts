// The pieces of the transform steps that the fused bin-and-aggregate kernel
// shares with the steps themselves. Imported by relative path only, so none
// of it is a package subpath or part of the plugin ABI.
import { aggregateFieldName } from './aggregateFieldName.ts'
import {
  NO_COLUMN,
  TableRow,
  numberReaderOf,
  readerOf,
  valueAt,
} from './featureTable.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import { isJexl } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'

import type { Column, FeatureTable, MadeRows } from './featureTable.ts'
import type {
  AggregateOp,
  AggregateStep,
  BinStep,
} from './markEncodingTypes.ts'
import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'

export const DEFAULT_BIN_AS: [string, string] = ['start', 'end']
/** What a `bin` over `fields` writes on each piece: the bases of its interval inside its bin. */
export const BIN_OVERLAP_FIELD = 'overlap'

/**
 * A table's rows split into sections, each a contiguous range: `bounds[s]` is
 * where section `s` starts and `bounds[s + 1]` where it ends. A step keeps
 * its rows in section order, and one that groups rows groups within a
 * section, so a faceted request runs each step once over every section.
 */
export type Bounds = Uint32Array

export interface Staged {
  table: FeatureTable
  bounds: Bounds
}

// A step reads a name or a dotted path. A plain name reads the table's column;
// a path walks each row, chosen once per step. A computed field is a `formula`
// step's to make.
export function stepReader(table: FeatureTable, ref: string, step: string) {
  if (isJexl(ref)) {
    throw new Error(
      `${step} field is a name or a dotted path, and a formula step in front computes one (${ref})`,
    )
  }
  if (isPlainFieldRef(ref)) {
    return readerOf(table.column(ref))
  }
  const read = fieldReader(ref, undefined)
  return (i: number) => read(table.row(i))
}

export function stepNumberReader(
  table: FeatureTable,
  ref: string,
  step: string,
) {
  if (isPlainFieldRef(ref) && !isJexl(ref)) {
    return numberReaderOf(table.column(ref))
  }
  const read = stepReader(table, ref, step)
  return (i: number) => numericValue(read(i))
}

// A list holding one value is that value, as a VCF's ALT and INFO fields
// arrive, and a longer one is its text: a Map keys a list by identity, which
// made every row a group of its own. A missing value is one group, whether
// the field is absent or holds a VCF's `.`.
export function groupKey(value: unknown): unknown {
  return Array.isArray(value)
    ? value.length === 1
      ? (value[0] ?? undefined)
      : value.join(',')
    : (value ?? undefined)
}

export function binSize({ step }: BinStep) {
  if (!(step > 0)) {
    throw new Error(`a bin step needs a positive size (${step})`)
  }
  return step
}

/**
 * Each row's interval and the bins it overlaps, `first` to `last`, with each
 * section's lowest and highest bin: `first` NaN where the ends are not
 * numbers or run backwards, so the row is no piece. A zero-length interval
 * is its position's bin alone.
 */
export function intervalsOf(
  table: FeatureTable,
  [startField, endField]: [string, string],
  size: number,
  bounds: Bounds,
) {
  const n = table.length
  const readStart = stepNumberReader(table, startField, 'a bin')
  const readEnd = stepNumberReader(table, endField, 'a bin')
  const start = new Float64Array(n)
  const end = new Float64Array(n)
  const firstBin = new Float64Array(n)
  const lastBin = new Float64Array(n)
  const sections = bounds.length - 1
  const lowBin = new Float64Array(sections).fill(Infinity)
  const highBin = new Float64Array(sections).fill(-Infinity)
  let pieces = 0
  for (let s = 0; s < sections; s++) {
    let low = Infinity
    let high = -Infinity
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const rowS = readStart(i)
      const rowE = readEnd(i)
      start[i] = rowS
      end[i] = rowE
      if (!(Number.isFinite(rowS) && Number.isFinite(rowE) && rowE >= rowS)) {
        firstBin[i] = Number.NaN
        continue
      }
      const first = Math.floor(rowS / size)
      // The last bin starting before the end, found by the product the
      // pieces are cut at.
      let last = first
      while ((last + 1) * size < rowE) {
        last++
      }
      firstBin[i] = first
      lastBin[i] = last
      pieces += last - first + 1
      if (first < low) {
        low = first
      }
      if (last > high) {
        high = last
      }
    }
    lowBin[s] = low
    highBin[s] = high
  }
  return {
    start,
    end,
    first: firstBin,
    last: lastBin,
    pieces,
    lowBin,
    highBin,
  }
}

/**
 * Rows a step made from nothing: an `aggregate`'s groups and a `coverage`'s
 * runs, carrying only the fields they wrote and an id from their span, with
 * no feature to hang from.
 */
export class MadeTable implements MadeRows {
  readonly length: number
  private readonly columns: ReadonlyMap<string, Column>
  private readonly tags: (i: number) => string

  constructor(
    length: number,
    columns: ReadonlyMap<string, Column>,
    tags: (i: number) => string,
  ) {
    this.length = length
    this.columns = columns
    this.tags = tags
  }

  column(field: string): Column {
    return field === 'uniqueId'
      ? { kind: 'value', read: i => this.id(i) }
      : (this.columns.get(field) ?? NO_COLUMN)
  }

  id(i: number) {
    const at = (field: string) => String(valueAt(this.column(field), i))
    return `${at('refName')}:${at('start')}-${at('end')}${this.tags(i)}`
  }

  parentOfRow() {
    return undefined
  }

  row(i: number): Feature {
    return new TableRow(this, i)
  }

  json(i: number): SimpleFeatureSerialized {
    const out: Record<string, unknown> = {}
    for (const [field, column] of this.columns) {
      out[field] = valueAt(column, i)
    }
    out.uniqueId = this.id(i)
    return out as SimpleFeatureSerialized
  }
}

export function valueColumn(values: readonly unknown[]): Column {
  return { kind: 'value', read: i => values[i] }
}

// An aggregate's groups as rows, section by section: the groupby fields, the
// ops, and the reference name and extent each group spans.
export function madeGroups({
  groups,
  keys,
  ops,
  step,
  refNames,
  start,
  end,
  sectionOf,
  sections,
}: {
  groups: number
  keys: readonly [string, unknown[]][]
  ops: readonly Column[]
  step: AggregateStep
  refNames: unknown[]
  start: Float64Array
  end: Float64Array
  sectionOf: ArrayLike<number>
  sections: number
}): Staged {
  const columns = new Map<string, Column>()
  for (const [field, values] of keys) {
    columns.set(field, valueColumn(values))
  }
  for (const [k, agg] of step.ops.entries()) {
    columns.set(aggregateFieldName(agg), ops[k]!)
  }
  columns.set('refName', valueColumn(refNames))
  columns.set('start', { kind: 'number', values: start, at: undefined })
  columns.set('end', { kind: 'number', values: end, at: undefined })

  const serial = new Uint32Array(groups)
  const out = new Uint32Array(sections)
  let s = 0
  for (let g = 0; g < groups; g++) {
    while (s < sectionOf[g]!) {
      s++
      out[s] = g
    }
    serial[g] = g - out[s]!
  }
  for (s++; s < sections; s++) {
    out[s] = groups
  }
  return {
    table: new MadeTable(groups, columns, g => `#${serial[g]}`),
    bounds: out,
  }
}

// Whether an op reads its `weight`: a weight moves no minimum or maximum.
export function isWeighted({ op, weight }: AggregateOp) {
  return weight !== undefined && op !== 'min' && op !== 'max'
}

/**
 * One op's running sums per group, which the aggregate and the binned
 * aggregate both add rows to in row order, so the two answer the same
 * doubles. An unweighted row adds a weight of 1, which leaves every sum what
 * it was before weights.
 */
export class OpSums {
  readonly op: AggregateOp['op']
  private readonly readsValue: boolean
  readonly sum: Float64Array
  readonly weight: Float64Array
  readonly min: Float64Array
  readonly max: Float64Array

  constructor({ op, field }: AggregateOp, groups: number) {
    if (op !== 'count' && field === undefined) {
      throw new Error(`an aggregate ${op} needs a field`)
    }
    this.op = op
    this.readsValue = op !== 'count'
    this.sum = new Float64Array(groups)
    this.weight = new Float64Array(groups)
    this.min = new Float64Array(groups).fill(Infinity)
    this.max = new Float64Array(groups).fill(-Infinity)
  }

  add(g: number, v: number, w: number) {
    if ((this.readsValue && !Number.isFinite(v)) || !Number.isFinite(w)) {
      return
    }
    this.weight[g]! += w
    if (this.readsValue) {
      this.sum[g]! += v * w
      if (v < this.min[g]!) {
        this.min[g] = v
      }
      if (v > this.max[g]!) {
        this.max[g] = v
      }
    }
  }

  column(groups: number): Column {
    const { op } = this
    if (op === 'count' || op === 'sum') {
      const values = (op === 'count' ? this.weight : this.sum).slice(0, groups)
      return { kind: 'number', values, at: undefined }
    }
    const values = new Float64Array(groups)
    for (let g = 0; g < groups; g++) {
      values[g] =
        this.weight[g] === 0
          ? Number.NaN
          : op === 'mean'
            ? this.sum[g]! / this.weight[g]!
            : op === 'min'
              ? this.min[g]!
              : this.max[g]!
    }
    return { kind: 'number', values, at: undefined, nanIsAbsent: true }
  }
}
