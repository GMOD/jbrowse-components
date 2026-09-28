import { aggregateFieldName } from './aggregateFieldName.ts'
import { categoricalField } from './categoricalField.ts'
import {
  DerivedTable,
  NO_COLUMN,
  TableRow,
  WithTable,
  asTable,
  numberReaderOf,
  readerOf,
  selectRows,
  valueAt,
  withColumns,
} from './featureTable.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { numericValue } from './numericValue.ts'
import SimpleFeature, { buildJexlContext } from './simpleFeature.ts'
import { junctionEnds, svClassOfAlt, svClassOfToken } from './svAlt.ts'

import type { Column, FeatureTable, MadeRows } from './featureTable.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CellsStep,
  CoverageStep,
  FacetSection,
  FacetSpec,
  FieldRef,
  FlattenStep,
  PileupStep,
  TransformStep,
} from './markEncodingTypes.ts'
import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'

export const DEFAULT_BIN_FIELD = 'start'
export const DEFAULT_BIN_AS: [string, string] = ['start', 'end']
export const DEFAULT_FLATTEN_FIELD = 'subfeatures'
export const DEFAULT_CELLS_FIELD = 'seq'
export const DEFAULT_COVERAGE_AS = 'coverage'
export const DEFAULT_PILEUP_AS = 'row'
export const DEFAULT_PILEUP_FIELDS: [string, string] = ['start', 'end']

/**
 * A table's rows split into sections, each a contiguous range: `bounds[s]` is
 * where section `s` starts and `bounds[s + 1]` where it ends. A step keeps
 * its rows in section order, and one that groups rows groups within a
 * section, so a faceted request runs each step once over every section.
 */
type Bounds = Uint32Array

interface Staged {
  table: FeatureTable
  bounds: Bounds
}

function oneSection(n: number): Bounds {
  return Uint32Array.of(0, n)
}

// Section starts through a step whose rows came from its input's in order:
// each section starts at the first row whose parent row is in it.
function boundsThrough(bounds: Bounds, parentRow: Uint32Array): Bounds {
  const out = new Uint32Array(bounds.length)
  let at = 0
  for (let s = 0; s < bounds.length; s++) {
    const edge = bounds[s]!
    while (at < parentRow.length && parentRow[at]! < edge) {
      at++
    }
    out[s] = at
  }
  return out
}

function expression(expr: string, jexl: JexlInstance | undefined) {
  if (!jexl) {
    throw new Error(`a jexl transform needs a jexl instance (${expr})`)
  }
  return stringToJexlExpression(expr, jexl)
}

// A step reads a name or a dotted path. A plain name reads the table's column;
// a path walks each row, chosen once per step. A computed field is a `formula`
// step's to make.
function stepReader(table: FeatureTable, ref: string, step: string) {
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

function stepNumberReader(table: FeatureTable, ref: string, step: string) {
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
function groupKey(value: unknown): unknown {
  return Array.isArray(value)
    ? value.length === 1
      ? (value[0] ?? undefined)
      : value.join(',')
    : (value ?? undefined)
}

class RowsBuilder {
  data = new Uint32Array(256)
  length = 0

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

function filter(
  { table, bounds }: Staged,
  expr: string,
  jexl: JexlInstance | undefined,
): Staged {
  const compiled = expression(expr, jexl)
  const kept = new RowsBuilder()
  for (let i = 0; i < table.length; i++) {
    if (compiled.eval(buildJexlContext({ feature: table.row(i) }))) {
      kept.push(i)
    }
  }
  const parentRow = kept.finish()
  return {
    table: selectRows(table, parentRow),
    bounds: boundsThrough(bounds, parentRow),
  }
}

function formula(
  { table, bounds }: Staged,
  expr: string,
  as: string,
  jexl: JexlInstance | undefined,
): Staged {
  const compiled = expression(expr, jexl)
  const values = new Array<unknown>(table.length)
  for (let i = 0; i < table.length; i++) {
    values[i] = compiled.eval(buildJexlContext({ feature: table.row(i) }))
  }
  const column: Column = { kind: 'value', read: i => values[i] }
  return { table: new WithTable(table, new Map([[as, column]])), bounds }
}

function isFeature(item: unknown): item is Feature {
  return typeof (item as Feature | undefined)?.get === 'function'
}

// An array's elements in order, or a record's entries keyed by name; a
// feature standing in the field is neither.
function fannedEntries(items: unknown): [string | number, unknown][] {
  if (Array.isArray(items)) {
    return [...items.entries()]
  }
  return typeof items === 'object' && items !== null && !isFeature(items)
    ? Object.entries(items)
    : []
}

/**
 * The entries a `flatten` fanned out, one row each over the container row it
 * came from. An entry answers a field it carries — a feature its own, a
 * record its own key, a plain value the fanned field — and the container
 * answers the rest, except the fanned field itself, so an entry never reads
 * back its siblings. A container kept with nothing to fan out is a row of its
 * own that reads everything off itself.
 */
class FlatTable extends DerivedTable {
  private readonly field: string
  private readonly items: readonly unknown[]
  private readonly at: readonly (string | number | undefined)[]
  private readonly position: Uint32Array
  private readonly indexField: string | undefined
  private readonly keyField: string | undefined

  constructor(
    parent: FeatureTable,
    parentRow: Uint32Array,
    field: string,
    items: readonly unknown[],
    at: readonly (string | number | undefined)[],
    position: Uint32Array,
    step: FlattenStep,
  ) {
    super(parent, parentRow)
    this.field = field
    this.items = items
    this.at = at
    this.position = position
    this.indexField = step.index
    this.keyField = step.key
  }

  override get madeFrom() {
    return true
  }

  /** A container kept with nothing to fan out: the row is the container. */
  isKept(i: number) {
    return this.at[i] === undefined
  }

  override row(i: number): Feature {
    return this.isKept(i) ? this.parent.row(this.parentOf(i)) : super.row(i)
  }

  // An entry's value for a field, `undefined` where it states none.
  private entryValue(i: number, name: string) {
    if (this.at[i] === undefined) {
      return undefined
    }
    const item = this.items[i]
    if (isFeature(item)) {
      return item.get(name)
    }
    if (typeof item === 'object' && item !== null) {
      return name === 'uniqueId'
        ? this.id(i)
        : (item as Record<string, unknown>)[name]
    }
    return name === this.field ? item : undefined
  }

  private isOwnKey(i: number) {
    return this.keyField !== undefined && typeof this.at[i] === 'string'
  }

  // The key as codes into the names met, where every row is an entry keyed
  // by name: a record's species or samples, which a facet then splits on
  // once per name.
  private keyCategory(): Column | undefined {
    const codes = new Uint32Array(this.length)
    const labels: string[] = []
    const codeOf = new Map<string, number>()
    for (let i = 0; i < this.length; i++) {
      const at = this.at[i]
      if (typeof at !== 'string') {
        return undefined
      }
      let code = codeOf.get(at)
      if (code === undefined) {
        code = labels.length
        codeOf.set(at, code)
        labels.push(at)
      }
      codes[i] = code
    }
    return { kind: 'category', codes, labels, at: undefined }
  }

  protected own(name: string): Column | undefined {
    const read = readerOf(this.inherited(name))
    const fanned = name === this.field
    const entryThenContainer = (i: number) => {
      const v = this.entryValue(i, name)
      return v === undefined && (!fanned || this.isKept(i)) ? read(i) : v
    }
    if (name === this.indexField) {
      const { position } = this
      return {
        kind: 'value',
        read: i =>
          this.at[i] === undefined ? entryThenContainer(i) : position[i],
      }
    }
    if (name === this.keyField) {
      return (
        this.keyCategory() ?? {
          kind: 'value',
          read: i => (this.isOwnKey(i) ? this.at[i] : entryThenContainer(i)),
        }
      )
    }
    return { kind: 'value', read: entryThenContainer }
  }

  override id(i: number) {
    const at = this.at[i]
    const container = this.parent.row(this.parentOf(i))
    if (at === undefined) {
      return container.id()
    }
    const item = this.items[i]
    return isFeature(item) ? item.id() : `${container.id()}#${at}`
  }

  override json(i: number): SimpleFeatureSerialized {
    const containerRow = this.parent.row(this.parentOf(i))
    const at = this.at[i]
    const own: Record<string, unknown> = {}
    if (this.indexField !== undefined && at !== undefined) {
      own[this.indexField] = this.position[i]
    }
    if (this.keyField !== undefined && this.isOwnKey(i)) {
      own[this.keyField] = at
    }
    if (at === undefined) {
      return { ...containerRow.toJSON(), ...own }
    }
    const item = this.items[i]
    if (!isFeature(item) && (typeof item !== 'object' || item === null)) {
      return { ...containerRow.toJSON(), [this.field]: item, ...own }
    }
    const { [this.field]: _siblings, ...container } = containerRow.toJSON()
    const entry = isFeature(item)
      ? item.toJSON()
      : new SimpleFeature({
          refName: containerRow.get('refName'),
          start: containerRow.get('start'),
          end: containerRow.get('end'),
          ...item,
          uniqueId: this.id(i),
        }).toJSON()
    return { ...container, ...entry, ...own }
  }
}

function flatten({ table, bounds }: Staged, step: FlattenStep): Staged {
  const { field = DEFAULT_FLATTEN_FIELD, keepEmpty } = step
  const read = stepReader(table, field, 'a flatten')
  const parentRow = new RowsBuilder()
  const position = new RowsBuilder()
  const items: unknown[] = []
  const at: (string | number | undefined)[] = []
  for (let i = 0; i < table.length; i++) {
    const entries = fannedEntries(read(i))
    if (entries.length === 0) {
      if (keepEmpty) {
        parentRow.push(i)
        position.push(0)
        items.push(undefined)
        at.push(undefined)
      }
      continue
    }
    for (const [p, [key, item]] of entries.entries()) {
      parentRow.push(i)
      position.push(p)
      items.push(item)
      at.push(key)
    }
  }
  const rows = parentRow.finish()
  return {
    table: new FlatTable(
      table,
      rows,
      field,
      items,
      at,
      position.finish(),
      step,
    ),
    bounds: boundsThrough(bounds, rows),
  }
}

const DASH = 45
const SPACE = 32
const LOWER_BIT = 0x20

const CELL_STATES = ['match', 'mismatch', 'gap', 'insertion'] as const
const MATCH = 0
const MISMATCH = 1
const GAP = 2
const INSERTION = 3
const NO_STATE = 255

function isGapByte(b: number) {
  return b === DASH || b === SPACE
}

// The columns carrying the row's own sequence: a gap run reaching either end
// of the row measures where the block was cut, not the alignment, so it is no
// cell either.
function alignedColumns(row: string): [number, number] {
  let first = 0
  while (first < row.length && isGapByte(row.charCodeAt(first))) {
    first++
  }
  let last = row.length - 1
  while (last > first && isGapByte(row.charCodeAt(last))) {
    last--
  }
  return [first, last]
}

// The row a cell step reads against: past any table that only reordered or
// annotated the rows, the one they were fanned out of.
function containerOf(table: FeatureTable) {
  let at: FeatureTable = table
  let toBase: Uint32Array | undefined
  while (at instanceof DerivedTable && !at.madeFrom) {
    toBase = at.parentRow ? compose(toBase, at.parentRow) : toBase
    at = at.parent
  }
  if (!(at instanceof DerivedTable)) {
    return undefined
  }
  return {
    made: at,
    toMade: toBase,
    table: at.parent,
    row: at.parentRow ? compose(toBase, at.parentRow) : toBase,
  }
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

/**
 * The runs a `cells` step answers, one per stretch of one state against the
 * reference, typed: each run's span, its state and the text column it starts
 * at, with `base`, `match` and `length` read back out of the texts when asked
 * for.
 */
class CellTable extends DerivedTable {
  private readonly start: Uint32Array
  private readonly end: Uint32Array
  private readonly state: Uint8Array
  private readonly textAt: Uint32Array
  private readonly rowText: (row: number) => string
  private readonly refText: (row: number) => string
  private firstOfRow: Uint32Array | undefined
  private derived = new Map<string, Column>()

  constructor(
    parent: FeatureTable,
    parentRow: Uint32Array,
    lanes: {
      start: Uint32Array
      end: Uint32Array
      state: Uint8Array
      textAt: Uint32Array
    },
    rowText: (row: number) => string,
    refText: (row: number) => string,
  ) {
    super(parent, parentRow)
    this.start = lanes.start
    this.end = lanes.end
    this.state = lanes.state
    this.textAt = lanes.textAt
    this.rowText = rowText
    this.refText = refText
  }

  override get madeFrom() {
    return true
  }

  private laneOf(name: string, build: () => Column) {
    let column = this.derived.get(name)
    if (!column) {
      column = build()
      this.derived.set(name, column)
    }
    return column
  }

  protected own(name: string): Column | undefined {
    switch (name) {
      case 'start': {
        return { kind: 'number', values: this.start, at: undefined }
      }
      case 'end': {
        return { kind: 'number', values: this.end, at: undefined }
      }
      case 'state': {
        return {
          kind: 'category',
          codes: this.state,
          labels: CELL_STATES,
          at: undefined,
        }
      }
      case 'match': {
        return this.laneOf(name, () => {
          const values = new Float32Array(this.length)
          for (let i = 0; i < this.length; i++) {
            const s = this.state[i]
            values[i] = s === MATCH ? 1 : s === MISMATCH ? 0 : Number.NaN
          }
          return { kind: 'number', values, at: undefined, nanIsAbsent: true }
        })
      }
      case 'length': {
        return this.laneOf(name, () => {
          const values = new Float32Array(this.length).fill(Number.NaN)
          for (let i = 0; i < this.length; i++) {
            if (this.state[i] === INSERTION) {
              values[i] = this.inserted(i).length
            }
          }
          return { kind: 'number', values, at: undefined, nanIsAbsent: true }
        })
      }
      case 'base': {
        return this.laneOf(name, () => {
          const values = new Array<string | undefined>(this.length)
          for (let i = 0; i < this.length; i++) {
            const s = this.state[i]
            values[i] =
              s === MISMATCH
                ? this.rowText(this.parentOf(i))[this.textAt[i]!]
                : s === INSERTION
                  ? this.inserted(i)
                  : undefined
          }
          return { kind: 'value', read: i => values[i] }
        })
      }
      default: {
        return undefined
      }
    }
  }

  // The bases a row holds where the reference has none, from the column the
  // insertion starts at to the reference's next base.
  private inserted(i: number) {
    const row = this.rowText(this.parentOf(i))
    const ref = this.refText(this.parentOf(i))
    let out = ''
    for (
      let col = this.textAt[i]!;
      col < row.length && ref.charCodeAt(col) === DASH;
      col++
    ) {
      if (!isGapByte(row.charCodeAt(col))) {
        out += row[col]
      }
    }
    return out
  }

  override id(i: number) {
    const p = this.parentOf(i)
    this.firstOfRow ??= firstRowIndex(this.parentRow!, this.parent.length)
    return `${this.parent.row(p).id()}#${i - this.firstOfRow[p]!}`
  }

  override json(i: number): SimpleFeatureSerialized {
    const out: Record<string, unknown> = {
      ...this.parent.row(this.parentOf(i)).toJSON(),
      start: this.start[i],
      end: this.end[i],
      state: CELL_STATES[this.state[i]!],
    }
    for (const name of ['base', 'match', 'length']) {
      const v = valueAt(this.column(name), i)
      if (v !== undefined) {
        out[name] = v
      }
    }
    return out as SimpleFeatureSerialized
  }
}

// The lanes a `cells` walk writes, doubled as a row would overrun them.
class RunLanes {
  start = new Uint32Array(1024)
  end = new Uint32Array(1024)
  state = new Uint8Array(1024)
  textAt = new Uint32Array(1024)
  parentRow = new Uint32Array(1024)
  length = 0

  reserve(more: number) {
    const need = this.length + more
    if (need <= this.start.length) {
      return
    }
    const size = Math.max(this.start.length * 2, need)
    const widen = <T extends Uint8Array | Uint32Array>(a: T): T => {
      const next = new (a.constructor as new (size: number) => T)(size)
      next.set(a)
      return next
    }
    this.start = widen(this.start)
    this.end = widen(this.end)
    this.state = widen(this.state)
    this.textAt = widen(this.textAt)
    this.parentRow = widen(this.parentRow)
  }
}

// Where each parent row's children start, for children written parent by
// parent in order.
function firstRowIndex(parentRow: Uint32Array, parents: number) {
  const first = new Uint32Array(parents)
  for (let i = parentRow.length - 1; i >= 0; i--) {
    first[parentRow[i]!] = i
  }
  return first
}

function cells({ table, bounds }: Staged, step: CellsStep): Staged {
  const { field = DEFAULT_CELLS_FIELD } = step
  const container = containerOf(table)
  const readRow = readerOf(table.column(field))
  const byParent = (r: number) => table.row(r).parent?.()?.get(field)
  const readContainer = container
    ? readerOf(container.table.column(field))
    : undefined
  const refRow = container?.row
  // A container a flatten kept with nothing to fan out is the row itself, so
  // its reference is its own container's, as its `parent()` says.
  const made = container?.made
  const toMade = container?.toMade
  const kept =
    made instanceof FlatTable
      ? (r: number) => made.isKept(toMade ? toMade[r]! : r)
      : undefined
  const readRef = readContainer
    ? (r: number) =>
        kept?.(r) ? byParent(r) : readContainer(refRow ? refRow[r]! : r)
    : byParent
  const readStart = numberReaderOf(table.column('start'))
  const rowText = (r: number) => readRow(r) as string
  const refText = (r: number) => readRef(r) as string

  const lanes = new RunLanes()
  for (let r = 0; r < table.length; r++) {
    const ref = readRef(r)
    const row = readRow(r)
    let pos = readStart(r)
    if (typeof ref !== 'string' || typeof row !== 'string' || !(pos >= 0)) {
      continue
    }
    // A run per column is the most a row can answer, so the lanes grow once
    // per row and the walk below writes through locals.
    lanes.reserve(ref.length + 1)
    const { start, end, state, textAt, parentRow } = lanes
    let n = lanes.length
    const [first, last] = alignedColumns(row)
    let runStart = -1
    let runState = NO_STATE
    let runBase = -1
    let runCol = 0
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
        start[n] = pos
        end[n] = pos
        state[n] = INSERTION
        textAt[n] = insertAt
        parentRow[n] = r
        n++
        insertAt = -1
      }
      const drawn = col >= first && col <= last && col < row.length
      const st = !drawn
        ? NO_STATE
        : isGapByte(rowByte)
          ? GAP
          : (refByte | LOWER_BIT) === (rowByte | LOWER_BIT)
            ? MATCH
            : MISMATCH
      const base = st === MISMATCH ? rowByte : -1
      if (st !== runState || base !== runBase) {
        if (runStart >= 0) {
          start[n] = runStart
          end[n] = pos
          state[n] = runState
          textAt[n] = runCol
          parentRow[n] = r
          n++
        }
        runStart = st === NO_STATE ? -1 : pos
        runState = st
        runBase = base
        runCol = col
      }
      pos++
    }
    if (runStart >= 0) {
      start[n] = runStart
      end[n] = pos
      state[n] = runState
      textAt[n] = runCol
      parentRow[n] = r
      n++
    }
    lanes.length = n
  }
  const n = lanes.length
  const rows = lanes.parentRow.slice(0, n)
  return {
    table: new CellTable(
      table,
      rows,
      {
        start: lanes.start.slice(0, n),
        end: lanes.end.slice(0, n),
        state: lanes.state.slice(0, n),
        textAt: lanes.textAt.slice(0, n),
      },
      rowText,
      refText,
    ),
    bounds: boundsThrough(bounds, rows),
  }
}

interface MateEnd {
  refName: string
  start: number
  end: number
  mateDirection: number
}

function statedMate(f: Feature): MateEnd | undefined {
  const mate = f.get('mate') as Partial<MateEnd> | undefined
  return mate?.refName !== undefined && mate.start !== undefined
    ? {
        refName: mate.refName,
        start: mate.start,
        end: mate.end ?? mate.start + 1,
        mateDirection: mate.mateDirection ?? 0,
      }
    : undefined
}

function mateFields(
  f: Feature,
  alt: string | undefined,
  mate: MateEnd,
  ownDirection: number,
  alleleIndex = 0,
) {
  const info = f.get('INFO') as Record<string, unknown> | undefined
  const svType =
    alt === undefined
      ? svClassOfToken(
          String((info?.SVTYPE as unknown[] | undefined)?.[0] ?? ''),
        )
      : svClassOfAlt(alt, {
          ref: f.get('REF') as string | undefined,
          info,
          alleleIndex,
        })
  return {
    mate,
    mateDirection: ownDirection,
    ...(alt === undefined ? {} : { alt }),
    ...(svType ? { svType } : {}),
  }
}

/**
 * #api
 * How a record states its other end, or undefined where it states none: the
 * `mate` a paired adapter fills (BEDPE, STAR-Fusion), or an `ALT` the breakend
 * and symbolic-SV readers resolve. The `mate` step admits exactly the features
 * this names one for, so a caller deciding whether links are the picture a
 * track wants asks here rather than re-reading the fields.
 */
export function matedBy(f: Feature) {
  if (statedMate(f)) {
    return 'mate' as const
  }
  const alts = f.get('ALT')
  return Array.isArray(alts) &&
    (alts as string[]).some((alt, i) => junctionEnds(f, alt, i))
    ? ('alt' as const)
    : undefined
}

/**
 * The ends a `mate` step admitted: each a row of the record it came from, with
 * its mate's fields beside the record's, an allele of a record with several
 * named by its position.
 */
class MateTable extends DerivedTable {
  private readonly fields: readonly Record<string, unknown>[]
  private readonly ids: readonly (string | undefined)[]

  constructor(
    parent: FeatureTable,
    parentRow: Uint32Array,
    fields: readonly Record<string, unknown>[],
    ids: readonly (string | undefined)[],
  ) {
    super(parent, parentRow)
    this.fields = fields
    this.ids = ids
  }

  protected own(name: string): Column | undefined {
    if (!this.fields.some(f => name in f)) {
      return undefined
    }
    const read = readerOf(this.inherited(name))
    return {
      kind: 'value',
      read: i => (name in this.fields[i]! ? this.fields[i]![name] : read(i)),
    }
  }

  override id(i: number) {
    return this.ids[i] ?? super.id(i)
  }

  override json(i: number): SimpleFeatureSerialized {
    return { ...super.json(i), ...this.fields[i]! }
  }
}

function mates({ table, bounds }: Staged): Staged {
  const parentRow = new RowsBuilder()
  const fields: Record<string, unknown>[] = []
  const ids: (string | undefined)[] = []
  const out = new Uint32Array(bounds.length)
  for (let s = 0; s + 1 < bounds.length; s++) {
    out[s] = parentRow.length
    const seen = new Set<string>()
    const admit = (
      i: number,
      f: Feature,
      mate: MateEnd,
      written: Record<string, unknown>,
      id?: string,
    ) => {
      const here = `${f.get('refName')}:${f.get('start')}-${f.get('end')}`
      const there = `${mate.refName}:${mate.start}-${mate.end}`
      const key = here < there ? `${here}|${there}` : `${there}|${here}`
      if (!seen.has(key)) {
        seen.add(key)
        parentRow.push(i)
        fields.push(written)
        ids.push(id)
      }
    }
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const f = table.row(i)
      const stated = statedMate(f)
      if (stated) {
        const ends = junctionEnds(f)!
        const mate = { ...stated, mateDirection: ends.mate.keeps }
        admit(i, f, mate, mateFields(f, undefined, mate, ends.own.keeps))
        continue
      }
      const alts = f.get('ALT')
      if (!Array.isArray(alts)) {
        continue
      }
      for (const [a, alt] of (alts as string[]).entries()) {
        const ends = junctionEnds(f, alt, a)
        if (!ends) {
          continue
        }
        const mate = {
          refName: ends.mate.refName,
          start: ends.mate.pos,
          end: ends.mate.pos + 1,
          mateDirection: ends.mate.keeps,
        }
        admit(
          i,
          f,
          mate,
          mateFields(f, alt, mate, ends.own.keeps, a),
          alts.length > 1 ? `${f.id()}#${a}` : undefined,
        )
      }
    }
  }
  out[bounds.length - 1] = parentRow.length
  return {
    table: new MateTable(table, parentRow.finish(), fields, ids),
    bounds: out,
  }
}

function bin({ table, bounds }: Staged, step: BinStep): Staged {
  const { field = DEFAULT_BIN_FIELD, step: size } = step
  if (!(size > 0)) {
    throw new Error(`a bin step needs a positive size (${size})`)
  }
  const [asStart, asEnd] = step.as ?? DEFAULT_BIN_AS
  const read = stepNumberReader(table, field, 'a bin')
  const n = table.length
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const s = Math.floor(read(i) / size) * size
    starts[i] = s
    ends[i] = s + size
  }
  const written = new Map<string, Column>([
    [asStart, { kind: 'number', values: starts, at: undefined }],
    [asEnd, { kind: 'number', values: ends, at: undefined }],
  ])
  return { table: new WithTable(table, written), bounds }
}

/**
 * Rows a step made from nothing: an `aggregate`'s groups and a `coverage`'s
 * runs, carrying only the fields they wrote and an id from their span, with
 * no feature to hang from.
 */
class MadeTable implements MadeRows {
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

function valueColumn(values: readonly unknown[]): Column {
  return { kind: 'value', read: i => values[i] }
}

// Each row's group, numbered in the order groups are first met, a section
// being the outermost level: the groups keyed by their raw values, one Map
// level per groupby field, where a string key built per row was the
// aggregate's whole cost.
function groupRows(
  n: number,
  bounds: Bounds,
  reads: readonly ((i: number) => unknown)[],
  normalize: boolean,
) {
  type Trie = Map<unknown, Trie | number>
  const groupOf = new Uint32Array(n)
  const firstRow: number[] = []
  const sectionOf: number[] = []
  const last = reads.length - 1
  for (let s = 0; s + 1 < bounds.length; s++) {
    const root: Trie = new Map()
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      let g: number
      if (reads.length === 0) {
        g =
          firstRow.length > 0 && sectionOf.at(-1) === s
            ? firstRow.length - 1
            : -1
        if (g < 0) {
          g = firstRow.length
          firstRow.push(i)
          sectionOf.push(s)
        }
      } else {
        let node = root
        for (let l = 0; l < last; l++) {
          const raw = reads[l]!(i)
          const v = normalize && typeof raw !== 'object' ? raw : groupKey(raw)
          let next = node.get(v) as Trie | undefined
          if (!next) {
            next = new Map()
            node.set(v, next)
          }
          node = next
        }
        const raw = reads[last]!(i)
        const v = normalize && typeof raw !== 'object' ? raw : groupKey(raw)
        let at = node.get(v) as number | undefined
        if (at === undefined) {
          at = firstRow.length
          node.set(v, at)
          firstRow.push(i)
          sectionOf.push(s)
        }
        g = at
      }
      groupOf[i] = g
    }
  }
  return { groupOf, firstRow, sectionOf }
}

function aggregate({ table, bounds }: Staged, step: AggregateStep): Staged {
  const { groupby = [], ops } = step
  const n = table.length
  const keyed = groupby.some(field => !isPlainFieldRef(field))
  const reads = groupby.map(field =>
    keyed
      ? stepReader(table, field, 'an aggregate')
      : readerOf(table.column(field)),
  )
  const { groupOf, firstRow, sectionOf } = groupRows(n, bounds, reads, !keyed)
  const groups = firstRow.length

  const readStart = readerOf(table.column('start'))
  const readEnd = readerOf(table.column('end'))
  const readRefName = readerOf(table.column('refName'))
  const start = new Float64Array(groups).fill(Infinity)
  const end = new Float64Array(groups).fill(-Infinity)
  for (let i = 0; i < n; i++) {
    const g = groupOf[i]!
    start[g] = Math.min(start[g]!, readStart(i) as number)
    end[g] = Math.max(end[g]!, readEnd(i) as number)
  }

  const columns = new Map<string, Column>()
  for (const [f, field] of groupby.entries()) {
    const read = reads[f]!
    columns.set(field, valueColumn(firstRow.map(i => groupKey(read(i)))))
  }
  for (const agg of ops) {
    columns.set(
      aggregateFieldName(agg),
      aggregateColumn(table, agg, groupOf, groups),
    )
  }
  columns.set('refName', valueColumn(firstRow.map(i => readRefName(i))))
  columns.set('start', { kind: 'number', values: start, at: undefined })
  columns.set('end', { kind: 'number', values: end, at: undefined })

  const serial = new Uint32Array(groups)
  const out = new Uint32Array(bounds.length)
  let s = 0
  for (let g = 0; g < groups; g++) {
    while (s < sectionOf[g]!) {
      s++
      out[s] = g
    }
    serial[g] = g - out[s]!
  }
  for (s++; s < bounds.length; s++) {
    out[s] = groups
  }
  return {
    table: new MadeTable(groups, columns, g => `#${serial[g]}`),
    bounds: out,
  }
}

function aggregateColumn(
  table: FeatureTable,
  { op, field }: AggregateOp,
  groupOf: Uint32Array,
  groups: number,
): Column {
  const n = table.length
  if (op === 'count') {
    const counts = new Float64Array(groups)
    for (let i = 0; i < n; i++) {
      counts[groupOf[i]!]!++
    }
    return { kind: 'number', values: counts, at: undefined }
  }
  if (field === undefined) {
    throw new Error(`an aggregate ${op} needs a field`)
  }
  const read = stepNumberReader(table, field, 'an aggregate')
  const sum = new Float64Array(groups)
  const count = new Float64Array(groups)
  const min = new Float64Array(groups).fill(Infinity)
  const max = new Float64Array(groups).fill(-Infinity)
  for (let i = 0; i < n; i++) {
    const v = read(i)
    if (!Number.isFinite(v)) {
      continue
    }
    const g = groupOf[i]!
    sum[g]! += v
    count[g]!++
    if (v < min[g]!) {
      min[g] = v
    }
    if (v > max[g]!) {
      max[g] = v
    }
  }
  if (op === 'sum') {
    return { kind: 'number', values: sum, at: undefined }
  }
  const values = new Float64Array(groups)
  for (let g = 0; g < groups; g++) {
    values[g] =
      count[g] === 0
        ? Number.NaN
        : op === 'mean'
          ? sum[g]! / count[g]!
          : op === 'min'
            ? min[g]!
            : max[g]!
  }
  return { kind: 'number', values, at: undefined, nanIsAbsent: true }
}

// Rows in start order, ties in the order they came: a start and a row packed
// into one double and sorted without a comparator, which leaves the typed
// sort's fast path only where the packing could not be exact.
function sortByStart(rows: Uint32Array, starts: Float64Array) {
  const n = rows.length
  let lo = Infinity
  let hi = -Infinity
  let whole = true
  for (let k = 0; k < n; k++) {
    const v = starts[rows[k]!]!
    if (v < lo) {
      lo = v
    }
    if (v > hi) {
      hi = v
    }
    whole &&= Number.isInteger(v)
  }
  if (whole && (hi - lo + 1) * n < Number.MAX_SAFE_INTEGER) {
    const keys = new Float64Array(n)
    for (let k = 0; k < n; k++) {
      keys[k] = (starts[rows[k]!]! - lo) * n + k
    }
    keys.sort()
    const placed = Uint32Array.from(rows)
    for (let k = 0; k < n; k++) {
      rows[k] = placed[keys[k]! % n]!
    }
  } else {
    rows.sort((a, b) => starts[a]! - starts[b]! || a - b)
  }
}

/**
 * The lowest row each row fits on, greedy first fit in start order within its
 * section, as a step in front of the encoder rather than a packer behind it.
 * The rows come out in start order, as the packing met them.
 */
function pileup({ table, bounds }: Staged, step: PileupStep): Staged {
  const as = step.as ?? DEFAULT_PILEUP_AS
  const [startField, endField] = step.fields ?? DEFAULT_PILEUP_FIELDS
  const padding = step.padding ?? 0
  const n = table.length
  const readStart = stepNumberReader(table, startField, 'a pileup')
  const readEnd = stepNumberReader(table, endField, 'a pileup')
  const starts = new Float64Array(n)
  const ends = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = readStart(i)
    ends[i] = readEnd(i)
  }
  const order = new Uint32Array(n)
  const packed = new Float64Array(n)
  for (let s = 0; s + 1 < bounds.length; s++) {
    const lo = bounds[s]!
    const hi = bounds[s + 1]!
    let inOrder = true
    for (let i = lo + 1; i < hi; i++) {
      inOrder &&= starts[i]! >= starts[i - 1]!
    }
    // Any unreadable start leaves the section out of order. Read as Infinity,
    // it sorts last and packs where it claims no row a readable one could
    // want, where NaN left the sort without an order and a row's end
    // unreadable.
    if (!inOrder) {
      for (let i = lo; i < hi; i++) {
        if (Number.isNaN(starts[i])) {
          starts[i] = Infinity
        }
      }
    }
    for (let i = lo; i < hi; i++) {
      order[i] = i
    }
    if (!inOrder) {
      sortByStart(order.subarray(lo, hi), starts)
    }
    const rowEnds: number[] = []
    for (let k = lo; k < hi; k++) {
      const i = order[k]!
      const start = starts[i]!
      const end = ends[i]!
      let row = 0
      while (row < rowEnds.length && rowEnds[row]! > start) {
        row++
      }
      rowEnds[row] = (end > start ? end : start) + padding
      packed[k] = row
    }
  }
  const written = new Map<string, Column>([
    [as, { kind: 'number', values: packed, at: undefined }],
  ])
  return { table: withColumns(table, written, order), bounds }
}

/**
 * Piecewise-constant depth over the rows' spans, per section: one row per run
 * of equal depth, where the depth is not zero. A sweep over the sorted edges,
 * so the input need not be sorted.
 */
function coverage({ table, bounds }: Staged, step: CoverageStep): Staged {
  const as = step.as ?? DEFAULT_COVERAGE_AS
  const readStart = numberReaderOf(table.column('start'))
  const readEnd = numberReaderOf(table.column('end'))
  const readRefName = readerOf(table.column('refName'))
  // Each edge opens or closes one run at most, so two a row bounds the runs.
  const capacity = 2 * table.length
  const outStart = new Float64Array(capacity)
  const outEnd = new Float64Array(capacity)
  const outDepth = new Float64Array(capacity)
  const outSection = new Uint32Array(capacity)
  const sectionRef: unknown[] = []
  const out = new Uint32Array(bounds.length)
  let k = 0
  for (let s = 0; s + 1 < bounds.length; s++) {
    out[s] = k
    const lo = bounds[s]!
    const hi = bounds[s + 1]!
    const spanStarts = new Float64Array(hi - lo)
    const spanEnds = new Float64Array(hi - lo)
    let n = 0
    for (let i = lo; i < hi; i++) {
      const start = readStart(i)
      const end = readEnd(i)
      if (Number.isFinite(start) && Number.isFinite(end)) {
        spanStarts[n] = start
        spanEnds[n] = end
        n++
      }
    }
    sectionRef.push(n > 0 ? readRefName(lo) : undefined)
    if (n === 0) {
      continue
    }
    const starts = spanStarts.subarray(0, n).sort()
    const ends = spanEnds.subarray(0, n).sort()
    const first = k
    let depth = 0
    let runStart = starts[0]!
    let si = 0
    let ei = 0
    while (si < n || ei < n) {
      const nextStart = si < n ? starts[si]! : Infinity
      const nextEnd = ei < n ? ends[ei]! : Infinity
      const at = Math.min(nextStart, nextEnd)
      if (depth > 0 && at > runStart) {
        if (
          k > first &&
          outEnd[k - 1] === runStart &&
          outDepth[k - 1] === depth
        ) {
          outEnd[k - 1] = at
        } else {
          outStart[k] = runStart
          outEnd[k] = at
          outDepth[k] = depth
          outSection[k] = s
          k++
        }
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
  }
  out[bounds.length - 1] = k
  const section = outSection.slice(0, k)
  const columns = new Map<string, Column>([
    ['refName', { kind: 'value', read: i => sectionRef[section[i]!] }],
    ['start', { kind: 'number', values: outStart.slice(0, k), at: undefined }],
    ['end', { kind: 'number', values: outEnd.slice(0, k), at: undefined }],
    [as, { kind: 'number', values: outDepth.slice(0, k), at: undefined }],
  ])
  return {
    table: new MadeTable(k, columns, () => ''),
    bounds: out,
  }
}

function runStep(
  staged: Staged,
  step: TransformStep,
  jexl: JexlInstance | undefined,
): Staged {
  switch (step.type) {
    case 'filter': {
      return filter(staged, step.expr, jexl)
    }
    case 'formula': {
      return formula(staged, step.expr, step.as, jexl)
    }
    case 'flatten': {
      return flatten(staged, step)
    }
    case 'cells': {
      return cells(staged, step)
    }
    case 'bin': {
      return bin(staged, step)
    }
    case 'aggregate': {
      return aggregate(staged, step)
    }
    case 'coverage': {
      return coverage(staged, step)
    }
    case 'pileup': {
      return pileup(staged, step)
    }
    case 'mate': {
      return mates(staged)
    }
  }
}

function runSteps(
  staged: Staged,
  steps: readonly TransformStep[] | undefined,
  jexl: JexlInstance | undefined,
) {
  let current = staged
  for (const step of steps ?? []) {
    current = runStep(current, step, jexl)
  }
  return current
}

function rowOf(value: unknown) {
  const row = Number(value)
  return row > 0 ? Math.floor(row) : 0
}

/**
 * #api
 * One layer of a faceted request: its rows in section order, and the stacked
 * row of each, index for index.
 */
export interface FacetedLayer {
  table: FeatureTable
  rows: Uint32Array
}

/**
 * #api
 * A faceted request's layers: the rows split on the facet's field, the
 * facet's own steps and then each layer's run over each section alone, and
 * the sections stacked — a section's rows start where the one above it ends,
 * and it is as tall as the tallest layer packed it. Every layer's rows come
 * back in section order beside their stacked rows, so a faceted display is
 * the unfaceted one drawn once per section, and a row is handed on as its
 * steps left it. A layer naming no `row` field stands on each section's first
 * row, the answer the unfaceted encoder gives it.
 *
 * The split is a counting sort into section order rather than a list per
 * section: every step runs once over the ordered rows, keeping section order,
 * and one that groups rows groups within a section.
 */
export function facetLayers(
  input: readonly Feature[] | FeatureTable,
  facet: FacetSpec,
  layers: readonly { transform?: readonly TransformStep[]; row?: FieldRef }[],
  jexl?: JexlInstance,
): { layers: FacetedLayer[]; sections: FacetSection[] } {
  const table = asTable(input)
  const { field, transform: sectionSteps } = facet
  const categories = categoricalField(field)
  const n = table.length
  const sectionOfKey = new Map<string, number>()
  const keyOfRow = new Uint32Array(n)
  const keys: string[] = []
  const keyIndex = (key: string) => {
    let k = sectionOfKey.get(key)
    if (k === undefined) {
      k = keys.length
      sectionOfKey.set(key, k)
      keys.push(key)
    }
    return k
  }
  const column = isPlainFieldRef(field) ? table.column(field) : undefined
  if (column?.kind === 'category') {
    // A label's key is filed once, and each row looks its code up.
    const { codes, labels, at } = column
    const ofCode = new Int32Array(labels.length).fill(-1)
    for (let i = 0; i < n; i++) {
      const code = codes[at ? at[i]! : i]!
      let k = ofCode[code]!
      if (k < 0) {
        k = keyIndex(categories.key(labels[code]))
        ofCode[code] = k
      }
      keyOfRow[i] = k
    }
  } else {
    const read = column
      ? readerOf(column)
      : (() => {
          const r = fieldReader(field, jexl)
          return (i: number) => r(table.row(i))
        })()
    for (let i = 0; i < n; i++) {
      keyOfRow[i] = keyIndex(categories.key(read(i)))
    }
  }
  const ordered = [...keys.keys()].sort((a, b) =>
    categories.compare(keys[a]!, keys[b]!),
  )
  const sectionOf = new Uint32Array(keys.length)
  for (const [s, k] of ordered.entries()) {
    sectionOf[k] = s
  }
  const bounds = new Uint32Array(keys.length + 1)
  for (let i = 0; i < n; i++) {
    bounds[sectionOf[keyOfRow[i]!]! + 1]!++
  }
  for (let s = 0; s < keys.length; s++) {
    bounds[s + 1] = bounds[s + 1]! + bounds[s]!
  }
  const next = bounds.slice(0, keys.length)
  const order = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    order[next[sectionOf[keyOfRow[i]!]!]!++] = i
  }

  const sectioned = runSteps(
    { table: selectRows(table, order), bounds },
    sectionSteps,
    jexl,
  )
  const placed = layers.map(({ transform, row }) => {
    const out = runSteps(sectioned, transform, jexl)
    const readRow =
      row === undefined
        ? undefined
        : isPlainFieldRef(row)
          ? readerOf(out.table.column(row))
          : (() => {
              const r = fieldReader(row, jexl)
              return (i: number) => r(out.table.row(i))
            })()
    const local = new Uint32Array(out.table.length)
    if (readRow) {
      for (let i = 0; i < local.length; i++) {
        local[i] = rowOf(readRow(i))
      }
    }
    return { ...out, local }
  })
  const rowCount = new Uint32Array(keys.length).fill(1)
  for (const { bounds: b, local } of placed) {
    for (let s = 0; s < keys.length; s++) {
      for (let i = b[s]!; i < b[s + 1]!; i++) {
        if (local[i]! + 1 > rowCount[s]!) {
          rowCount[s] = local[i]! + 1
        }
      }
    }
  }
  const sections: FacetSection[] = []
  const firstRow = new Uint32Array(keys.length)
  let stacked = 0
  for (const [s, k] of ordered.entries()) {
    firstRow[s] = stacked
    sections.push({ key: keys[k]!, firstRow: stacked, rowCount: rowCount[s]! })
    stacked += rowCount[s]!
  }
  return {
    layers: placed.map(({ table: t, bounds: b, local }) => {
      const rows = new Uint32Array(t.length)
      for (let s = 0; s < keys.length; s++) {
        for (let i = b[s]!; i < b[s + 1]!; i++) {
          rows[i] = firstRow[s]! + local[i]!
        }
      }
      return { table: t, rows }
    }),
    sections,
  }
}

/**
 * #api
 * Run the transform steps over a feature list or a table, in order, in the
 * worker. The table a step answers is what the next one reads, and the last
 * one is what the encoder walks.
 */
export function runTransforms(
  input: readonly Feature[] | FeatureTable,
  steps: readonly TransformStep[],
  jexl?: JexlInstance,
): FeatureTable {
  const table = asTable(input)
  return runSteps({ table, bounds: oneSection(table.length) }, steps, jexl)
    .table
}

// The fields a step writes onto its rows, which a partition on one of them
// has to wait for; none for a step that must see every row at once.
function writes(step: TransformStep): readonly string[] | undefined {
  switch (step.type) {
    case 'filter': {
      return []
    }
    case 'formula': {
      return [step.as]
    }
    case 'bin': {
      return step.as ?? DEFAULT_BIN_AS
    }
    case 'cells': {
      return ['start', 'end', 'state', 'base', 'match', 'length']
    }
    default: {
      return undefined
    }
  }
}

/**
 * How many of `steps` must run before rows can be split on `field`: the rest
 * each read a row and answer rows of it in order without writing `field`, so
 * running them after the split answers the same rows in the same order. A step
 * that groups rows, fans a row out into entries that may carry their own
 * `field`, or pairs rows up must run before it, and so must everything ahead
 * of it.
 */
function partitionPoint(steps: readonly TransformStep[], field: FieldRef) {
  if (!isPlainFieldRef(field)) {
    return steps.length
  }
  let at = steps.length
  while (at > 0 && writes(steps[at - 1]!)?.includes(field) === false) {
    at--
  }
  return at
}

/**
 * #api
 * A layered request's rows: the shared steps, the facet's split where it
 * names one, and each layer's own steps, with the row each layer's rows stand
 * in — the field it names, or under a facet each row's stacked row. The split
 * comes as early as it can: after the last shared step that must see every
 * row, so the steps that follow it read the rows already in section order.
 */
export function layerTables(
  input: readonly Feature[] | FeatureTable,
  request: {
    transform?: readonly TransformStep[]
    facet?: FacetSpec
    layers: readonly { transform?: readonly TransformStep[]; row?: FieldRef }[]
  },
  jexl?: JexlInstance,
): {
  layers: { table: FeatureTable; row: FieldRef | Uint32Array | undefined }[]
  sections: FacetSection[] | undefined
} {
  const { transform = [], facet, layers } = request
  if (!facet) {
    const shared = runTransforms(input, transform, jexl)
    return {
      layers: layers.map(layer => ({
        table: layer.transform?.length
          ? runTransforms(shared, layer.transform, jexl)
          : shared,
        row: layer.row,
      })),
      sections: undefined,
    }
  }
  const at = partitionPoint(transform, facet.field)
  const split = facetLayers(
    runTransforms(input, transform.slice(0, at), jexl),
    {
      ...facet,
      transform: [...transform.slice(at), ...(facet.transform ?? [])],
    },
    layers,
    jexl,
  )
  return {
    layers: split.layers.map(({ table, rows }) => ({ table, row: rows })),
    sections: split.sections,
  }
}
