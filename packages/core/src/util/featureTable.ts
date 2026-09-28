import { numericValue } from './numericValue.ts'

import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'

/**
 * #api
 * A typed lane a step wrote, one number per row.
 */
export type NumberLane =
  | Float64Array
  | Float32Array
  | Uint32Array
  | Int32Array
  | Uint16Array
  | Uint8Array

/**
 * #api
 * Codes into a list of labels, one per row.
 */
export type CodeLane = Uint8Array | Uint16Array | Uint32Array

/**
 * #api
 * A field's values over a table's rows, resolved once per step so the loop
 * reading it is chosen before the loop runs: a lane a step wrote, codes into
 * labels, a field read off the parser's own features, or a value a step
 * computes per row. `at` is the row each of the table's rows reads, where the
 * lane or the features belong to a table this one stands on.
 */
export type Column =
  | {
      kind: 'number'
      values: NumberLane
      at: Uint32Array | undefined
      /** A `NaN` in the lane is a row holding no value, which `get` answers as `undefined`. */
      nanIsAbsent?: boolean
    }
  | {
      kind: 'category'
      codes: CodeLane
      labels: readonly string[]
      at: Uint32Array | undefined
    }
  | {
      kind: 'feature'
      features: readonly Feature[]
      field: string
      at: Uint32Array | undefined
    }
  | { kind: 'value'; read: (row: number) => unknown }
  | { kind: 'none' }

/**
 * #api
 * The rows one step of a mark's declaration hands the next: a column per
 * field and a view of one row as a `Feature`, for a `jexl:` expression, a
 * channel reader and the hover.
 */
export interface FeatureTable {
  readonly length: number
  column(field: string): Column
  row(i: number): Feature
}

export const NO_COLUMN: Column = { kind: 'none' }

/**
 * #api
 * A column's value at a row, whatever its kind: for a loop that reads few rows.
 */
export function valueAt(column: Column, i: number): unknown {
  switch (column.kind) {
    case 'number': {
      const v = column.values[column.at ? column.at[i]! : i]!
      return column.nanIsAbsent && Number.isNaN(v) ? undefined : v
    }
    case 'category': {
      return column.labels[column.codes[column.at ? column.at[i]! : i]!]
    }
    case 'feature': {
      return column.features[column.at ? column.at[i]! : i]!.get(column.field)
    }
    case 'value': {
      return column.read(i)
    }
    case 'none': {
      return undefined
    }
  }
}

/**
 * #api
 * A reader of a column's values by row, its kind resolved here once. A
 * `number` lane with no index reads straight off the lane.
 */
export function readerOf(column: Column): (i: number) => unknown {
  switch (column.kind) {
    case 'number': {
      const { values, at } = column
      if (column.nanIsAbsent) {
        return i => {
          const v = values[at ? at[i]! : i]!
          return Number.isNaN(v) ? undefined : v
        }
      }
      return at ? i => values[at[i]!] : i => values[i]
    }
    case 'category': {
      const { codes, labels, at } = column
      return at ? i => labels[codes[at[i]!]!] : i => labels[codes[i]!]
    }
    case 'feature': {
      const { features, field, at } = column
      return at
        ? i => features[at[i]!]!.get(field)
        : i => features[i]!.get(field)
    }
    case 'value': {
      return column.read
    }
    case 'none': {
      return () => undefined
    }
  }
}

/**
 * #api
 * {@link readerOf} as the number a quantitative channel or step reads,
 * `NaN` where a row holds none, by `numericValue`'s rules.
 */
export function numberReaderOf(column: Column): (i: number) => number {
  switch (column.kind) {
    case 'number': {
      const { values, at } = column
      return at ? i => values[at[i]!]! : i => values[i]!
    }
    case 'none': {
      return () => Number.NaN
    }
    case 'feature': {
      const { features, field, at } = column
      return at
        ? i => numericValue(features[at[i]!]!.get(field))
        : i => numericValue(features[i]!.get(field))
    }
    case 'category':
    case 'value': {
      const read = readerOf(column)
      return i => numericValue(read(i))
    }
  }
}

/**
 * A column of the table `at` indexes into, read from this one's rows: the
 * index composed into a lane's, or into a reader for a `value` column.
 */
export function throughIndex(column: Column, at: Uint32Array): Column {
  switch (column.kind) {
    case 'number':
    case 'category':
    case 'feature': {
      const inner = column.at
      if (!inner) {
        return { ...column, at }
      }
      const composed = new Uint32Array(at.length)
      for (let i = 0; i < at.length; i++) {
        composed[i] = inner[at[i]!]!
      }
      return { ...column, at: composed }
    }
    case 'value': {
      const { read } = column
      return { kind: 'value', read: i => read(at[i]!) }
    }
    case 'none': {
      return column
    }
  }
}

/** A table over the features an adapter answered, a field read off each. */
export class SourceTable implements FeatureTable {
  readonly length: number
  readonly features: readonly Feature[]

  constructor(features: readonly Feature[]) {
    this.features = features
    this.length = features.length
  }

  column(field: string): Column {
    return { kind: 'feature', features: this.features, field, at: undefined }
  }

  row(i: number) {
    return this.features[i]!
  }
}

/**
 * #api
 * A table over a feature list, or the table itself.
 */
export function asTable(
  input: readonly Feature[] | FeatureTable,
): FeatureTable {
  return isTable(input) ? input : new SourceTable(input)
}

function isTable(
  input: readonly Feature[] | FeatureTable,
): input is FeatureTable {
  return !Array.isArray(input)
}

/**
 * A table whose rows stand on another's: each row names the parent row it came
 * from, and a field it does not carry reads through to the parent's. A
 * subclass answers its own fields in `own`, `undefined` for one it does not
 * carry, and its own id and JSON.
 */
export abstract class DerivedTable implements MadeRows {
  readonly length: number
  readonly parent: FeatureTable
  readonly parentRow: Uint32Array | undefined
  private readonly resolved = new Map<string, Column>()

  constructor(
    parent: FeatureTable,
    parentRow: Uint32Array | undefined,
    length = parentRow ? parentRow.length : parent.length,
  ) {
    this.parent = parent
    this.parentRow = parentRow
    this.length = length
  }

  protected abstract own(field: string): Column | undefined

  /**
   * Whether a row was made from its parent row, as a flattened entry or a run
   * is, so the parent row is its `parent()`; otherwise the row is its parent
   * row with fields beside it, and its `parent()` is that row's.
   */
  get madeFrom() {
    return false
  }

  column(field: string): Column {
    let column = this.resolved.get(field)
    if (column === undefined) {
      column = this.own(field) ?? this.inherited(field)
      this.resolved.set(field, column)
    }
    return column
  }

  protected inherited(field: string): Column {
    const column = this.parent.column(field)
    return this.parentRow ? throughIndex(column, this.parentRow) : column
  }

  parentOf(i: number) {
    return this.parentRow ? this.parentRow[i]! : i
  }

  id(i: number) {
    return this.parent.row(this.parentOf(i)).id()
  }

  /** The row's fields over its parent's, as the hover shows them. */
  json(i: number): SimpleFeatureSerialized {
    return this.parent.row(this.parentOf(i)).toJSON()
  }

  parentOfRow(i: number) {
    const up = this.parent.row(this.parentOf(i))
    return this.madeFrom ? up : up.parent?.()
  }

  row(i: number): Feature {
    return new TableRow(this, i)
  }
}

/**
 * #api
 * A table whose rows a step made, which answers each row's identity, its
 * hover JSON and the feature it hangs from.
 */
export interface MadeRows extends FeatureTable {
  id(i: number): string
  json(i: number): SimpleFeatureSerialized
  parentOfRow(i: number): Feature | undefined
}

/**
 * One row of a table a step made, as a `Feature`: what a `jexl:` expression, a
 * channel reader and the hover read.
 */
export class TableRow implements Feature {
  private readonly table: MadeRows
  private readonly i: number

  constructor(table: MadeRows, i: number) {
    this.table = table
    this.i = i
  }

  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(name: string): unknown
  get(name: string): unknown {
    return valueAt(this.table.column(name), this.i)
  }

  id() {
    return this.table.id(this.i)
  }

  parent() {
    return this.table.parentOfRow(this.i)
  }

  toJSON(): SimpleFeatureSerialized {
    return this.table.json(this.i)
  }
}

/**
 * The parent's own rows, kept or reordered: what a `filter` and the facet's
 * section order answer. Every field and the row's identity read through.
 */
export class SelectTable extends DerivedTable {
  protected own() {
    return undefined
  }

  override row(i: number): Feature {
    return this.parent.row(this.parentOf(i))
  }
}

/**
 * The parent's rows, each with fields a step wrote beside the ones it
 * carries: a `formula`'s value, a `bin`'s edges. A written field shadows the
 * parent's of the same name.
 */
export class WithTable extends DerivedTable {
  private readonly written: ReadonlyMap<string, Column>

  constructor(
    parent: FeatureTable,
    written: ReadonlyMap<string, Column>,
    parentRow?: Uint32Array,
  ) {
    super(parent, parentRow)
    this.written = written
  }

  protected own(field: string) {
    return this.written.get(field)
  }

  override json(i: number): SimpleFeatureSerialized {
    const out: Record<string, unknown> = { ...super.json(i) }
    for (const [field, column] of this.written) {
      out[field] = valueAt(column, i)
    }
    return out as SimpleFeatureSerialized
  }
}

/**
 * #api
 * The table's rows `rows` names, in that order: over an adapter's features, a
 * source table over those features again, so every field still reads straight
 * off them; over rows a step made, a table standing on them.
 */
export function selectRows(
  table: FeatureTable,
  rows: Uint32Array,
): FeatureTable {
  if (table instanceof SourceTable) {
    const { features } = table
    const listed = new Array<Feature>(rows.length)
    for (let k = 0; k < rows.length; k++) {
      listed[k] = features[rows[k]!]!
    }
    return new SourceTable(listed)
  }
  return new SelectTable(table, rows)
}

/**
 * #api
 * The table's rows with `written` beside them, in the order `rows` names
 * where it names one.
 */
export function withColumns(
  table: FeatureTable,
  written: ReadonlyMap<string, Column>,
  rows?: Uint32Array,
): FeatureTable {
  return rows && table instanceof SourceTable
    ? new WithTable(selectRows(table, rows), written)
    : new WithTable(table, written, rows)
}
