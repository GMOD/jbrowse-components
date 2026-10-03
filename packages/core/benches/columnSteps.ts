// The mark display's `flatten`, `cells`, facet and encode over typed columns
// rather than one `Feature` per piece, for the MAF cells declaration
// (`plugins/maf/benches/mafOnMarks.bench.ts` times it against the MAF
// display's hand path and the Feature steps).
//
// A SPIKE, and bench-only, extending ADR-152's `columnTable.ts` with the three
// things a fanned-out MAF needs and a flat BigWig did not:
//
// - A table can be a view onto another's rows. `flatten` answers a table whose
//   rows are the records it fanned out, holding only the records and each
//   one's container index; a column the record lacks (`start`, the block's
//   `seq`) reads through to the container's row. `cells` answers runs the same
//   way, so `species` on a run is its row's.
// - A column is built the first time a step reads it, and never otherwise. A
//   declaration colouring by `state` builds no `base`, `match` or `length`.
// - A string column a categorical channel reads is a dictionary: the facet and
//   the colour resolve once per distinct value and index per run.
//
// It implements what the bench times and throws on the rest.
import {
  DASH,
  SPACE,
  firstDrawn,
  isGapByte,
  lastDrawn,
} from '../src/util/alignedBytes.ts'
import { categoricalField } from '../src/util/categoricalField.ts'
import {
  NO_STATE,
  cellState,
  comparesBase,
  opensRun,
  runKey,
} from '../src/util/cellsStep.ts'
import { cssColorToABGR } from '../src/util/colorBits.ts'
import { hitIndexOf } from '../src/util/markEncoding.ts'

import type { EncodedChannels } from '../src/util/markEncodingTypes.ts'
import type { Feature } from '../src/util/simpleFeature.ts'

export interface DictColumn {
  kind: 'dict'
  codes: Uint8Array | Uint32Array
  values: string[]
}

export type NumericColumn =
  | Float64Array
  | Float32Array
  | Uint32Array
  | Int32Array
  | Uint8Array

export type Column = NumericColumn | DictColumn | readonly unknown[]

export interface Table {
  length: number
  /** The table's own column, built on first read; undefined reads through. */
  own(name: string): Column | undefined
  parent?: Table
  /** Each row's row in `parent`. */
  parentIndex?: Uint32Array
  /** The parent's own rows, reordered or filtered, rather than rows made from them. */
  view?: true
}

function isDict(column: Column): column is DictColumn {
  return 'kind' in column
}

class Memo {
  private readonly built = new Map<string, Column | undefined>()

  get(name: string, build: () => Column | undefined) {
    if (!this.built.has(name)) {
      this.built.set(name, build())
    }
    return this.built.get(name)
  }
}

function fromValues(values: unknown[]): Column {
  const first = values.find(v => v !== undefined)
  if (typeof first === 'number') {
    return Float64Array.from(values as number[])
  }
  return values
}

/** The features an adapter answered, a column per field read. */
export class FeatureTable implements Table {
  readonly length: number
  private readonly features: readonly Feature[]
  private readonly memo = new Memo()

  constructor(features: readonly Feature[]) {
    this.features = features
    this.length = features.length
  }

  own(name: string) {
    return this.memo.get(name, () =>
      fromValues(this.features.map(f => f.get(name))),
    )
  }
}

/** The records a `flatten` fanned out, over the features they came from. */
class RecordTable implements Table {
  readonly length: number
  readonly parent: Table
  readonly parentIndex: Uint32Array
  private readonly records: readonly Record<string, unknown>[]
  private readonly keyName: string
  private readonly key: DictColumn
  private readonly memo = new Memo()

  constructor(
    records: readonly Record<string, unknown>[],
    parent: Table,
    parentIndex: Uint32Array,
    keyName: string,
    key: DictColumn,
  ) {
    this.records = records
    this.length = records.length
    this.parent = parent
    this.parentIndex = parentIndex
    this.keyName = keyName
    this.key = key
  }

  own(name: string) {
    if (name === this.keyName) {
      return this.key
    }
    return this.memo.get(name, () =>
      this.records.length > 0 && name in this.records[0]!
        ? fromValues(this.records.map(r => r[name]))
        : undefined,
    )
  }
}

/** A column read on a table, with the row it answers for each of the table's rows. */
export interface Resolved {
  column: Column
  index: Uint32Array | undefined
}

function compose(outer: Uint32Array | undefined, inner: Uint32Array) {
  if (!outer) {
    return inner
  }
  const out = new Uint32Array(outer.length)
  for (let i = 0; i < outer.length; i++) {
    out[i] = inner[outer[i]!]!
  }
  return out
}

export function resolve(table: Table, name: string): Resolved {
  let index: Uint32Array | undefined
  let at: Table | undefined = table
  while (at) {
    const column = at.own(name)
    if (column !== undefined) {
      return { column, index }
    }
    index = at.parentIndex ? compose(index, at.parentIndex) : index
    at = at.parent
  }
  throw new Error(`no table in the chain has a column "${name}"`)
}

class U32Builder {
  data: Uint32Array
  length = 0

  constructor(capacity = 1024) {
    this.data = new Uint32Array(capacity)
  }

  push(v: number) {
    if (this.length === this.data.length) {
      const next = new Uint32Array(this.data.length * 2)
      next.set(this.data)
      this.data = next
    }
    this.data[this.length++] = v
  }

  finish() {
    return this.data.slice(0, this.length)
  }
}

/** `flatten` over a record keyed by name, `key` naming the field the name goes to. */
export function flattenRecords(
  features: readonly Feature[],
  field: string,
  key: string,
): Table {
  const parent = new FeatureTable(features)
  const records: Record<string, unknown>[] = []
  const parentIndex = new U32Builder(features.length * 4)
  const codes = new U32Builder(features.length * 4)
  const codeOf = new Map<string, number>()
  const values: string[] = []
  for (let i = 0; i < features.length; i++) {
    const container = features[i]!.get(field) as
      | Record<string, Record<string, unknown>>
      | undefined
    if (container === undefined) {
      continue
    }
    if (Array.isArray(container)) {
      throw new Error('the column spike flattens records, not arrays')
    }
    for (const name in container) {
      let code = codeOf.get(name)
      if (code === undefined) {
        code = values.length
        codeOf.set(name, code)
        values.push(name)
      }
      records.push(container[name]!)
      parentIndex.push(i)
      codes.push(code)
    }
  }
  return new RecordTable(records, parent, parentIndex.finish(), key, {
    kind: 'dict',
    codes: codes.finish(),
    values,
  })
}

export const CELL_STATES = ['match', 'mismatch', 'gap', 'insertion'] as const
const MATCH = 0
const MISMATCH = 1
const INSERTION = 3

/**
 * Each row's text and its container's: `cells` reads the row against the
 * feature it was fanned out of, past any view that reordered the rows.
 */
interface RowTexts {
  rows: readonly string[]
  refs: readonly string[]
  rowOf: Uint32Array
  refOf: Uint32Array
}

function identity(n: number) {
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = i
  }
  return out
}

function rowTexts(rows: Table, field: string): RowTexts {
  let toBase: Uint32Array | undefined
  let base = rows
  while (base.view) {
    toBase = compose(toBase, base.parentIndex!)
    base = base.parent!
  }
  if (!base.parent || !base.parentIndex) {
    throw new Error('a cells step reads a row against its parent')
  }
  const toContainer = compose(toBase, base.parentIndex)
  const rowText = resolve(rows, field)
  const refText = resolve(base.parent, field)
  return {
    rows: rowText.column as readonly string[],
    refs: refText.column as readonly string[],
    rowOf: rowText.index ?? identity(rows.length),
    refOf: refText.index ? compose(toContainer, refText.index) : toContainer,
  }
}

/** The runs a `cells` step answers, the fields besides `state` derived on read. */
class CellsTable implements Table {
  readonly length: number
  readonly parent: Table
  readonly parentIndex: Uint32Array
  private readonly start: Uint32Array
  private readonly end: Uint32Array
  private readonly state: DictColumn
  private readonly textStart: Uint32Array
  private readonly texts: RowTexts
  private readonly memo = new Memo()

  constructor(
    parent: Table,
    parentIndex: Uint32Array,
    start: Uint32Array,
    end: Uint32Array,
    state: Uint8Array,
    textStart: Uint32Array,
    texts: RowTexts,
  ) {
    this.length = start.length
    this.parent = parent
    this.parentIndex = parentIndex
    this.start = start
    this.end = end
    this.state = { kind: 'dict', codes: state, values: [...CELL_STATES] }
    this.textStart = textStart
    this.texts = texts
  }

  private text(i: number) {
    const { rows, rowOf } = this.texts
    return rows[rowOf[this.parentIndex[i]!]!]!
  }

  private ref(i: number) {
    const { refs, refOf } = this.texts
    return refs[refOf[this.parentIndex[i]!]!]!
  }

  own(name: string): Column | undefined {
    switch (name) {
      case 'start':
        return this.start
      case 'end':
        return this.end
      case 'state':
        return this.state
      case 'match':
        return this.memo.get(name, () => {
          const out = new Float32Array(this.length)
          const codes = this.state.codes
          for (let i = 0; i < this.length; i++) {
            const s = codes[i]!
            out[i] = comparesBase(s, this.ref(i).charCodeAt(this.textStart[i]!))
              ? s === MATCH
                ? 1
                : 0
              : Number.NaN
          }
          return out
        })
      case 'base':
        return this.memo.get(name, () => {
          const out = new Array<string | undefined>(this.length)
          const codes = this.state.codes
          for (let i = 0; i < this.length; i++) {
            const s = codes[i]!
            if (s === MISMATCH) {
              out[i] = this.text(i)[this.textStart[i]!]
            } else if (s === INSERTION) {
              out[i] = insertedBases(
                this.text(i),
                this.ref(i),
                this.textStart[i]!,
              )
            }
          }
          return out
        })
      default:
        return undefined
    }
  }
}

function insertedBases(row: string, ref: string, from: number) {
  let out = ''
  for (
    let col = from;
    col < row.length && ref.charCodeAt(col) === DASH;
    col++
  ) {
    if (!isGapByte(row.charCodeAt(col))) {
      out += row[col]
    }
  }
  return out
}

/**
 * `cells` over typed columns: ADR-187's walk, each run written as its
 * reference span, its state and the column it starts at, so `base` is read
 * back out of the text only when a mark asks for it.
 */
export function cellsColumns(rows: Table, field = 'seq'): Table {
  const texts = rowTexts(rows, field)
  const { rows: rowTexts_, refs: refTexts, rowOf, refOf } = texts
  const startOf = resolve(rows, 'start')
  const startIdx = startOf.index
  const starts = startOf.column as NumericColumn

  let total = 0
  for (let r = 0; r < rows.length; r++) {
    total += refTexts[refOf[r]!]?.length ?? 0
  }
  // A run per base is the bound a row can reach and far past what one does,
  // so the lanes start at an eighth of it and double as a row would overrun.
  let capacity = Math.max(1024, total >> 3)
  let outStart = new Uint32Array(capacity)
  let outEnd = new Uint32Array(capacity)
  let outState = new Uint8Array(capacity)
  let outText = new Uint32Array(capacity)
  let outParent = new Uint32Array(capacity)
  const grow = <T extends Uint8Array | Uint32Array>(a: T, size: number): T => {
    const next = new (a.constructor as new (n: number) => T)(size)
    next.set(a)
    return next
  }
  let n = 0

  for (let r = 0; r < rows.length; r++) {
    const ref = refTexts[refOf[r]!]
    const row = rowTexts_[rowOf[r]!]
    if (typeof ref !== 'string' || typeof row !== 'string') {
      continue
    }
    if (n + ref.length + 1 > capacity) {
      capacity = Math.max(capacity * 2, n + ref.length + 1)
      outStart = grow(outStart, capacity)
      outEnd = grow(outEnd, capacity)
      outState = grow(outState, capacity)
      outText = grow(outText, capacity)
      outParent = grow(outParent, capacity)
    }
    let first = 0
    while (first < row.length && isGapByte(row.charCodeAt(first))) {
      first++
    }
    let last = row.length - 1
    while (last > first && isGapByte(row.charCodeAt(last))) {
      last--
    }
    let pos = starts[startIdx ? startIdx[r]! : r]!
    let runStart = -1
    let runState = NO_STATE
    let openKey = -1
    let runText = 0
    let insertAt = -1
    for (let col = 0; col < ref.length; col++) {
      const refByte = ref.charCodeAt(col)
      const rowByte = col < row.length ? row.charCodeAt(col) : SPACE
      if (refByte === DASH) {
        if (insertAt < 0 && col < row.length && !isGapByte(rowByte)) {
          insertAt = col
        }
        continue
      }
      if (insertAt >= 0) {
        outStart[n] = pos
        outEnd[n] = pos
        outState[n] = INSERTION
        outText[n] = insertAt
        outParent[n] = r
        n++
        insertAt = -1
      }
      const state = cellState(
        refByte,
        rowByte,
        col >= first && col <= last && col < row.length,
      )
      const key = runKey(state, refByte)
      if (opensRun(state, key, runState, openKey)) {
        if (runStart >= 0) {
          outStart[n] = runStart
          outEnd[n] = pos
          outState[n] = runState
          outText[n] = runText
          outParent[n] = r
          n++
        }
        runStart = state === NO_STATE ? -1 : pos
        runState = state
        openKey = key
        runText = col
      }
      pos++
    }
    if (runStart >= 0) {
      outStart[n] = runStart
      outEnd[n] = pos
      outState[n] = runState
      outText[n] = runText
      outParent[n] = r
      n++
    }
  }
  return new CellsTable(
    rows,
    outParent.slice(0, n),
    outStart.slice(0, n),
    outEnd.slice(0, n),
    outState.slice(0, n),
    outText.slice(0, n),
    texts,
  )
}

/** `cellsColumns` walking each text copied into bytes, as the MAF packer's arena holds them. */
export function cellsColumnsBytes(rows: Table, field = 'seq'): Table {
  const encoder = new TextEncoder()
  let refBytes = new Uint8Array(256)
  let rowBytes = new Uint8Array(256)
  let lastRef: string | undefined
  let refLength = 0
  const texts = rowTexts(rows, field)
  const { rows: rowTexts_, refs: refTexts, rowOf, refOf } = texts
  const startOf = resolve(rows, 'start')
  const startIdx = startOf.index
  const starts = startOf.column as NumericColumn

  let total = 0
  for (let r = 0; r < rows.length; r++) {
    total += refTexts[refOf[r]!]?.length ?? 0
  }
  // A run per base is the bound a row can reach and far past what one does,
  // so the lanes start at an eighth of it and double as a row would overrun.
  let capacity = Math.max(1024, total >> 3)
  let outStart = new Uint32Array(capacity)
  let outEnd = new Uint32Array(capacity)
  let outState = new Uint8Array(capacity)
  let outText = new Uint32Array(capacity)
  let outParent = new Uint32Array(capacity)
  const grow = <T extends Uint8Array | Uint32Array>(a: T, size: number): T => {
    const next = new (a.constructor as new (n: number) => T)(size)
    next.set(a)
    return next
  }
  let n = 0

  for (let r = 0; r < rows.length; r++) {
    const ref = refTexts[refOf[r]!]
    const row = rowTexts_[rowOf[r]!]
    if (typeof ref !== 'string' || typeof row !== 'string') {
      continue
    }
    if (ref.length > refBytes.length) {
      refBytes = new Uint8Array(ref.length * 2)
      lastRef = undefined
    }
    if (row.length > rowBytes.length) {
      rowBytes = new Uint8Array(row.length * 2)
    }
    if (ref !== lastRef) {
      refLength = encoder.encodeInto(ref, refBytes).written
      lastRef = ref
    }
    const rowLength = encoder.encodeInto(row, rowBytes).written
    if (n + ref.length + 1 > capacity) {
      capacity = Math.max(capacity * 2, n + ref.length + 1)
      outStart = grow(outStart, capacity)
      outEnd = grow(outEnd, capacity)
      outState = grow(outState, capacity)
      outText = grow(outText, capacity)
      outParent = grow(outParent, capacity)
    }
    const first = firstDrawn(rowBytes, 0, rowLength)
    const last = lastDrawn(rowBytes, 0, rowLength, first)
    let pos = starts[startIdx ? startIdx[r]! : r]!
    let runStart = -1
    let runState = NO_STATE
    let openKey = -1
    let runText = 0
    let insertAt = -1
    for (let col = 0; col < refLength; col++) {
      const refByte = refBytes[col]!
      const rowByte = col < rowLength ? rowBytes[col]! : SPACE
      if (refByte === DASH) {
        if (insertAt < 0 && col < rowLength && !isGapByte(rowByte)) {
          insertAt = col
        }
        continue
      }
      if (insertAt >= 0) {
        outStart[n] = pos
        outEnd[n] = pos
        outState[n] = INSERTION
        outText[n] = insertAt
        outParent[n] = r
        n++
        insertAt = -1
      }
      const state = cellState(
        refByte,
        rowByte,
        col >= first && col <= last && col < rowLength,
      )
      const key = runKey(state, refByte)
      if (opensRun(state, key, runState, openKey)) {
        if (runStart >= 0) {
          outStart[n] = runStart
          outEnd[n] = pos
          outState[n] = runState
          outText[n] = runText
          outParent[n] = r
          n++
        }
        runStart = state === NO_STATE ? -1 : pos
        runState = state
        openKey = key
        runText = col
      }
      pos++
    }
    if (runStart >= 0) {
      outStart[n] = runStart
      outEnd[n] = pos
      outState[n] = runState
      outText[n] = runText
      outParent[n] = r
      n++
    }
  }
  return new CellsTable(
    rows,
    outParent.slice(0, n),
    outStart.slice(0, n),
    outEnd.slice(0, n),
    outState.slice(0, n),
    outText.slice(0, n),
    texts,
  )
}

/** A categorical column read per row: its dictionary and each row's code. */
function dictOf(table: Table, name: string) {
  const { column, index } = resolve(table, name)
  if (!isDict(column)) {
    throw new Error(`the column spike reads "${name}" as a dictionary`)
  }
  return { values: column.values, codes: column.codes, index }
}

/**
 * The facet's stacked rows over a dictionary field: each key's section in the
 * field's order, one row a section, and each row of the table on its key's.
 */
export function facetRows(table: Table, field: string) {
  const { values, codes, index } = dictOf(table, field)
  const categories = categoricalField(field)
  const met = new Uint8Array(values.length)
  const n = table.length
  for (let i = 0; i < n; i++) {
    met[codes[index ? index[i]! : i]!] = 1
  }
  const keys = values.map(v => categories.key(v))
  const order = [...new Set(keys.filter((_, c) => met[c]))].sort(
    categories.compare,
  )
  const sectionOfKey = new Map(order.map((key, s) => [key, s]))
  const rowOfCode = Uint32Array.from(keys, key => sectionOfKey.get(key) ?? 0)
  const row = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    row[i] = rowOfCode[codes[index ? index[i]! : i]!]!
  }
  return {
    row,
    sections: order.map((key, s) => ({ key, firstRow: s, rowCount: 1 })),
  }
}

export interface ColumnSpanEncoding {
  color: { field: string; domain?: string[]; range?: string[] }
}

/**
 * A span's lanes over the table: its extent, the facet's row, and a
 * categorical colour resolved once per dictionary entry.
 */
export function encodeSpanColumns(
  table: Table,
  encoding: ColumnSpanEncoding,
  row: Uint32Array,
  withIndex: boolean,
): EncodedChannels {
  const n = table.length
  const x = resolve(table, 'start')
  const x2 = resolve(table, 'end')
  if (
    x.index ||
    x2.index ||
    !(x.column instanceof Uint32Array) ||
    !(x2.column instanceof Uint32Array)
  ) {
    throw new Error('the column spike encodes its own uint32 extent')
  }
  const { field, domain, range } = encoding.color
  const { values, codes, index } = dictOf(table, field)
  const colorField = categoricalField(field, { domain, range })
  const abgrOfCode = Uint32Array.from(values, v =>
    cssColorToABGR(colorField.color(colorField.key(v))),
  )
  const met = new Uint8Array(values.length)
  const color = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const code = codes[index ? index[i]! : i]!
    color[i] = abgrOfCode[code]!
    met[code] = 1
  }
  const featureIndex = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    featureIndex[i] = i
  }
  const entries = [
    ...new Set(values.filter((_, c) => met[c]).map(v => colorField.key(v))),
  ]
    .sort(colorField.compare)
    .map(value => ({
      value,
      color: cssColorToABGR(colorField.color(value)),
    }))
  const encoded: EncodedChannels = {
    count: n,
    skipped: 0,
    skippedPosition: 0,
    x: x.column,
    x2: x2.column,
    row,
    color,
    featureIndex,
    yMin: Infinity,
    yMax: -Infinity,
    scale: {
      kind: 'categorical',
      field,
      domain: [...colorField.domain],
      ...(range ? { range: [...range] } : {}),
      entries,
    },
  }
  if (withIndex && n > 0) {
    encoded.flatbushData = hitIndexOf(x.column, x2.column, undefined, n).data
  }
  return encoded
}

/**
 * `bin` cutting each interval at the bin edges, then `aggregate mean` of
 * `field` per key and bin weighted by the bases each piece puts in its bin:
 * the identity the MAF display draws when `field` is a run's `match`. A row
 * with no finite value is no piece.
 */
export function binnedMeanColumns(
  table: Table,
  step: number,
  field: string,
  groupField: string,
) {
  const values = resolve(table, field)
  const valueColumn = values.column as NumericColumn
  const valueIdx = values.index
  const { codes, index, values: keys } = dictOf(table, groupField)
  const starts = resolve(table, 'start').column as Uint32Array
  const ends = resolve(table, 'end').column as Uint32Array
  const n = table.length
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, starts[i]!)
    hi = Math.max(hi, ends[i]!)
  }
  const firstBin = Math.floor(lo / step)
  const bins = Math.max(0, Math.ceil(hi / step) - firstBin)
  const cells = bins * keys.length
  const weight = new Float64Array(cells)
  const weighted = new Float64Array(cells)
  for (let i = 0; i < n; i++) {
    const v = valueColumn[valueIdx ? valueIdx[i]! : i]!
    if (!Number.isFinite(v)) {
      continue
    }
    const base = codes[index ? index[i]! : i]! * bins - firstBin
    const s = starts[i]!
    const e = ends[i]!
    for (let b = Math.floor(s / step); b * step < e; b++) {
      const w = Math.min(e, (b + 1) * step) - Math.max(s, b * step)
      const at = base + b
      weight[at] = weight[at]! + w
      weighted[at] = weighted[at]! + v * w
    }
  }
  let out = 0
  for (let c = 0; c < cells; c++) {
    if (weight[c]! > 0) {
      out++
    }
  }
  const outStart = new Uint32Array(out)
  const outEnd = new Uint32Array(out)
  const outMean = new Float32Array(out)
  const outKey = new Uint32Array(out)
  let k = 0
  for (let c = 0; c < cells; c++) {
    const w = weight[c]!
    if (w > 0) {
      const b = (c % bins) + firstBin
      outStart[k] = b * step
      outEnd[k] = (b + 1) * step
      outMean[k] = weighted[c]! / w
      outKey[k] = Math.floor(c / bins)
      k++
    }
  }
  return {
    length: out,
    start: outStart,
    end: outEnd,
    mean: outMean,
    key: { kind: 'dict', codes: outKey, values: keys } as DictColumn,
  }
}

/** A table's rows in another order, every column read through. */
class OrderedTable implements Table {
  readonly length: number
  readonly parent: Table
  readonly parentIndex: Uint32Array

  constructor(parent: Table, order: Uint32Array) {
    this.parent = parent
    this.parentIndex = order
    this.length = order.length
  }

  readonly view = true as const

  own() {
    return undefined
  }
}

/**
 * The facet ahead of the steps it splits: the table's rows counting-sorted
 * into the field's section order, stable, so a step that keeps its input's
 * order answers each section's pieces together. `section` is each ordered
 * row's.
 */
export function orderBySection(table: Table, field: string) {
  const { values, codes, index } = dictOf(table, field)
  const categories = categoricalField(field)
  const n = table.length
  const perCode = new Uint32Array(values.length)
  for (let i = 0; i < n; i++) {
    perCode[codes[index ? index[i]! : i]!]!++
  }
  const keys = values.map(v => categories.key(v))
  const order = [...new Set(keys.filter((_, c) => perCode[c]! > 0))].sort(
    categories.compare,
  )
  const sectionOfKey = new Map(order.map((key, s) => [key, s]))
  const sectionOfCode = Uint32Array.from(
    keys,
    key => sectionOfKey.get(key) ?? 0,
  )
  const offsets = new Uint32Array(order.length + 1)
  for (let c = 0; c < values.length; c++) {
    const at = sectionOfCode[c]! + 1
    offsets[at] = offsets[at]! + perCode[c]!
  }
  for (let s = 0; s < order.length; s++) {
    offsets[s + 1] = offsets[s + 1]! + offsets[s]!
  }
  const next = offsets.slice(0, order.length)
  const permutation = new Uint32Array(n)
  const section = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const s = sectionOfCode[codes[index ? index[i]! : i]!]!
    const at = next[s]!++
    permutation[at] = i
    section[at] = s
  }
  return {
    table: new OrderedTable(table, permutation) as Table,
    section,
    sections: order.map((key, s) => ({ key, firstRow: s, rowCount: 1 })),
  }
}

/**
 * Each piece's row, and where each row's pieces start, for pieces a step
 * answered over rows `orderBySection` ordered: the row lane, and the whole of
 * a span's hover index.
 */
export function sectionRows(
  pieces: Table,
  section: Uint32Array,
  sectionCount: number,
) {
  const n = pieces.length
  const parentIndex = pieces.parentIndex!
  const row = new Uint32Array(n)
  const offsets = new Uint32Array(sectionCount + 1)
  for (let i = 0; i < n; i++) {
    const s = section[parentIndex[i]!]!
    row[i] = s
    offsets[s + 1]!++
  }
  for (let s = 0; s < sectionCount; s++) {
    offsets[s + 1] = offsets[s + 1]! + offsets[s]!
  }
  return { row, offsets }
}

/**
 * The pieces of one row overlapping `[bpMin, bpMax]`, off the row's slice of
 * pieces in the order `cells` wrote them: their ends never fall, so the first
 * candidate is a binary search away, and a zero-width insertion is the only
 * piece that can start past a later one.
 */
export function spanHitsInRow(
  x: Uint32Array,
  x2: Uint32Array,
  offsets: Uint32Array,
  row: number,
  bpMin: number,
  bpMax: number,
) {
  let lo = offsets[row]!
  let hi = offsets[row + 1]!
  const end = hi
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (x2[mid]! < bpMin) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  const out: number[] = []
  for (let i = lo; i < end; i++) {
    const a = x[i]!
    const b = x2[i]!
    if (a <= bpMax) {
      out.push(i)
    } else if (a !== b) {
      break
    }
  }
  return out
}
