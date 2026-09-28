import { binnedAggregate, fusesBinAggregate } from './binnedAggregate.ts'
import { categoricalField } from './categoricalField.ts'
import {
  binnedCellMatches,
  fusesAfterCells,
  fusesCellMatches,
} from './cellMatches.ts'
import { cells } from './cellsStep.ts'
import {
  DerivedTable,
  NO_COLUMN,
  WithTable,
  asTable,
  numberReaderOf,
  readerOf,
  selectRows,
  throughIndex,
  valueAt,
  withColumns,
} from './featureTable.ts'
import { fieldReader, isPlainFieldRef } from './fieldReader.ts'
import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature, { buildJexlContext } from './simpleFeature.ts'
import {
  BIN_OVERLAP_FIELD,
  DEFAULT_BIN_AS,
  FannedTable,
  MadeTable,
  OpSums,
  binSize,
  boundsThrough,
  groupKey,
  intervalsOf,
  isWeighted,
  madeGroups,
  stepNumberReader,
  stepReader,
} from './stepTables.ts'
import { junctionEnds, svClassOfAlt, svClassOfToken } from './svAlt.ts'

import type { Column, FeatureTable, ListColumn } from './featureTable.ts'
import type { JexlInstance } from './jexlStrings.ts'
import type {
  AggregateOp,
  AggregateStep,
  BinStep,
  CoverageStep,
  FacetSection,
  FacetSpec,
  FieldRef,
  FlattenStep,
  PileupStep,
  TransformStep,
} from './markEncodingTypes.ts'
import type { Feature, SimpleFeatureSerialized } from './simpleFeature.ts'
import type { Bounds, Staged } from './stepTables.ts'

export { BIN_OVERLAP_FIELD, DEFAULT_BIN_AS } from './stepTables.ts'
export const DEFAULT_BIN_FIELD = 'start'
export const DEFAULT_FLATTEN_FIELD = 'subfeatures'
export { DEFAULT_CELLS_FIELD } from './cellsStep.ts'
export const DEFAULT_COVERAGE_AS = 'coverage'
export const DEFAULT_PILEUP_AS = 'row'
export const DEFAULT_PILEUP_FIELDS: [string, string] = ['start', 'end']

function oneSection(n: number): Bounds {
  return Uint32Array.of(0, n)
}

function expression(expr: string, jexl: JexlInstance | undefined) {
  if (!jexl) {
    throw new Error(`a jexl transform needs a jexl instance (${expr})`)
  }
  return stringToJexlExpression(expr, jexl)
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
 * The entries a `flatten` fanned out of a list or record a row holds. An
 * entry answers a field it carries — a feature its own, a record its own key,
 * a plain value the fanned field — and the container answers the rest,
 * except the fanned field itself, so an entry never reads back its siblings.
 */
class FlatTable extends FannedTable {
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

  isKept(i: number) {
    return this.at[i] === undefined
  }

  get hasKept() {
    return this.at.includes(undefined)
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

/**
 * The entries a `flatten` fanned out of a list column, which are the list's
 * own rows: an entry reads the fields its list holds straight off the list's
 * lanes, and the container the rest. A keyed entry is a record filed under
 * its name, any other a feature of its own.
 */
class ListFlatTable extends FannedTable {
  private readonly field: string
  private readonly list: ListColumn
  private readonly entryRow: Uint32Array | undefined
  private readonly position: Uint32Array
  private readonly kept: Uint8Array | undefined
  private readonly indexField: string | undefined
  private readonly keyField: string | undefined

  constructor(
    parent: FeatureTable,
    parentRow: Uint32Array,
    field: string,
    list: ListColumn,
    entryRow: Uint32Array | undefined,
    position: Uint32Array,
    kept: Uint8Array | undefined,
    step: FlattenStep,
  ) {
    super(parent, parentRow)
    this.field = field
    this.list = list
    this.entryRow = entryRow
    this.position = position
    this.kept = kept
    this.indexField = step.index
    this.keyField = step.key
  }

  isKept(i: number) {
    return this.kept?.[i] === 1
  }

  get hasKept() {
    return this.kept !== undefined
  }

  private entryOf(i: number) {
    return this.entryRow ? this.entryRow[i]! : i
  }

  private throughEntries(column: Column) {
    return this.entryRow ? throughIndex(column, this.entryRow) : column
  }

  private entryColumn(name: string): Column | undefined {
    const { keys, entries } = this.list
    if (name === this.indexField) {
      return { kind: 'number', values: this.position, at: undefined }
    }
    if (name === this.keyField && keys) {
      return this.throughEntries(keys)
    }
    if (name === this.field) {
      return NO_COLUMN
    }
    if (name === 'uniqueId' && keys) {
      return { kind: 'value', read: i => this.id(i) }
    }
    const column = entries.column(name)
    return column.kind === 'none' ? undefined : this.throughEntries(column)
  }

  protected own(name: string): Column | undefined {
    const column = this.entryColumn(name)
    const { kept } = this
    if (!kept || column === undefined) {
      return column
    }
    const entry = readerOf(column)
    const container = readerOf(this.inherited(name))
    return { kind: 'value', read: i => (kept[i] ? container(i) : entry(i)) }
  }

  override id(i: number) {
    const container = this.parent.row(this.parentOf(i))
    if (this.isKept(i)) {
      return container.id()
    }
    const { keys, entries } = this.list
    const j = this.entryOf(i)
    return keys
      ? `${container.id()}#${String(valueAt(keys, j))}`
      : entries.id(j)
  }

  override json(i: number): SimpleFeatureSerialized {
    const containerRow = this.parent.row(this.parentOf(i))
    if (this.isKept(i)) {
      return containerRow.toJSON()
    }
    const { keys, entries } = this.list
    const j = this.entryOf(i)
    const own: Record<string, unknown> = {}
    if (this.indexField !== undefined) {
      own[this.indexField] = this.position[i]
    }
    if (this.keyField !== undefined && keys) {
      own[this.keyField] = valueAt(keys, j)
    }
    const { [this.field]: _siblings, ...container } = containerRow.toJSON()
    const entry = keys
      ? {
          refName: containerRow.get('refName'),
          start: containerRow.get('start'),
          end: containerRow.get('end'),
          ...entries.record(j),
          uniqueId: this.id(i),
        }
      : entries.json(j)
    return { ...container, ...entry, ...own }
  }
}

// A list column fanned out: each row's entries in order, their positions and
// the entry rows they are, with no entry read.
function flattenList(
  { table, bounds }: Staged,
  step: FlattenStep,
  field: string,
  list: ListColumn,
): Staged {
  const { start, at } = list
  const n = table.length
  let size = 0
  let empty = 0
  for (let i = 0; i < n; i++) {
    const r = at ? at[i]! : i
    const count = start[r + 1]! - start[r]!
    size += count
    if (count === 0) {
      empty++
    }
  }
  const total = size + (step.keepEmpty ? empty : 0)
  const parentRow = new Uint32Array(total)
  const position = new Uint32Array(total)
  const entryRow = new Uint32Array(total)
  const kept = total > size ? new Uint8Array(total) : undefined
  let k = 0
  let inOrder = true
  for (let i = 0; i < n; i++) {
    const r = at ? at[i]! : i
    const from = start[r]!
    const to = start[r + 1]!
    if (from === to && kept) {
      parentRow[k] = i
      kept[k] = 1
      inOrder = false
      k++
    }
    for (let j = from; j < to; j++) {
      parentRow[k] = i
      position[k] = j - from
      entryRow[k] = j
      inOrder &&= j === k
      k++
    }
  }
  return {
    table: new ListFlatTable(
      table,
      parentRow,
      field,
      list,
      inOrder ? undefined : entryRow,
      position,
      kept,
      step,
    ),
    bounds: boundsThrough(bounds, parentRow),
  }
}

function flatten(staged: Staged, step: FlattenStep): Staged {
  const { field = DEFAULT_FLATTEN_FIELD } = step
  const column = isPlainFieldRef(field) ? staged.table.column(field) : undefined
  return column?.kind === 'list'
    ? flattenList(staged, step, field, column)
    : flattenValues(staged, step)
}

function flattenValues({ table, bounds }: Staged, step: FlattenStep): Staged {
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

// A paired read's mate, where the file places one: the sequence and position
// its next segment aligns to, one base of it.
function pairedMate(f: Feature): MateEnd | undefined {
  const refName = f.get('next_ref')
  const pos = f.get('next_pos')
  return typeof refName === 'string' && typeof pos === 'number' && pos >= 0
    ? { refName, start: pos, end: pos + 1, mateDirection: 0 }
    : undefined
}

/**
 * #api
 * How a record states its other end, or undefined where it states none: the
 * `mate` a paired adapter fills (BEDPE, STAR-Fusion), an `ALT` the breakend
 * and symbolic-SV readers resolve, or a read's `next_ref` and `next_pos`. The
 * `mate` step admits exactly the features this names one for, so a caller
 * deciding whether links are the picture a track wants asks here rather than
 * re-reading the fields.
 */
export function matedBy(f: Feature) {
  if (statedMate(f)) {
    return 'mate' as const
  }
  const alts = f.get('ALT')
  if (
    Array.isArray(alts) &&
    (alts as string[]).some((alt, i) => junctionEnds(f, alt, i))
  ) {
    return 'alt' as const
  }
  return pairedMate(f) ? ('pair' as const) : undefined
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
      here: string,
      there: string,
      written: Record<string, unknown>,
      id?: string,
    ) => {
      const key = here < there ? `${here}|${there}` : `${there}|${here}`
      if (!seen.has(key)) {
        seen.add(key)
        parentRow.push(i)
        fields.push(written)
        ids.push(id)
      }
    }
    const span = (f: Feature, mate: MateEnd) =>
      [
        `${f.get('refName')}:${f.get('start')}-${f.get('end')}`,
        `${mate.refName}:${mate.start}-${mate.end}`,
      ] as const
    for (let i = bounds[s]!; i < bounds[s + 1]!; i++) {
      const f = table.row(i)
      const stated = statedMate(f)
      if (stated) {
        const ends = junctionEnds(f)!
        const mate = { ...stated, mateDirection: ends.mate.keeps }
        admit(
          i,
          ...span(f, mate),
          mateFields(f, undefined, mate, ends.own.keeps),
        )
        continue
      }
      const alts = f.get('ALT')
      if (!Array.isArray(alts)) {
        // each read of a pair names the other's start, so the pair is one key
        const pair = pairedMate(f)
        if (pair) {
          admit(
            i,
            `${f.get('refName')}:${f.get('start')}`,
            `${pair.refName}:${pair.start}`,
            { mate: pair, mateDirection: 0 },
          )
        }
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
          ...span(f, mate),
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

function bin(staged: Staged, step: BinStep): Staged {
  return step.fields
    ? binIntervals(staged, step, step.fields)
    : binPoints(staged, step)
}

function binPoints({ table, bounds }: Staged, step: BinStep): Staged {
  const { field = DEFAULT_BIN_FIELD } = step
  const size = binSize(step)
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

function binIntervals(
  { table, bounds }: Staged,
  step: BinStep,
  fields: [string, string],
): Staged {
  const size = binSize(step)
  const [asStart, asEnd] = step.as ?? DEFAULT_BIN_AS
  const iv = intervalsOf(table, fields, size, bounds)
  const { pieces } = iv
  const parentRow = new Uint32Array(pieces)
  const binStart = new Float64Array(pieces)
  const binEnd = new Float64Array(pieces)
  const overlap = new Float64Array(pieces)
  let k = 0
  for (let i = 0; i < table.length; i++) {
    const first = iv.first[i]!
    if (Number.isNaN(first)) {
      continue
    }
    const s = iv.start[i]!
    const e = iv.end[i]!
    for (let b = first; b <= iv.last[i]!; b++) {
      const lo = b * size
      const hi = lo + size
      parentRow[k] = i
      binStart[k] = lo
      binEnd[k] = hi
      overlap[k] = Math.min(e, hi) - Math.max(s, lo)
      k++
    }
  }
  const written = new Map<string, Column>([
    [asStart, { kind: 'number', values: binStart, at: undefined }],
    [asEnd, { kind: 'number', values: binEnd, at: undefined }],
    [BIN_OVERLAP_FIELD, { kind: 'number', values: overlap, at: undefined }],
  ])
  return {
    table: new WithTable(table, written, parentRow),
    bounds: boundsThrough(bounds, parentRow),
  }
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
  return madeGroups({
    groups,
    keys: groupby.map((field, f): [string, unknown[]] => {
      const read = reads[f]!
      return [field, firstRow.map(i => groupKey(read(i)))]
    }),
    ops: ops.map(agg => aggregateColumn(table, agg, groupOf, groups)),
    step,
    refNames: firstRow.map(i => readRefName(i)),
    start,
    end,
    sectionOf,
    sections: bounds.length,
  })
}

function aggregateColumn(
  table: FeatureTable,
  agg: AggregateOp,
  groupOf: Uint32Array,
  groups: number,
): Column {
  const n = table.length
  const sums = new OpSums(agg, groups)
  const { field, weight } = agg
  const readValue =
    agg.op === 'count' || field === undefined
      ? () => Number.NaN
      : stepNumberReader(table, field, 'an aggregate')
  const readWeight =
    weight !== undefined && isWeighted(agg)
      ? stepNumberReader(table, weight, 'an aggregate')
      : () => 1
  for (let i = 0; i < n; i++) {
    sums.add(groupOf[i]!, readValue(i), readWeight(i))
  }
  return sums.column(groups)
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
  const list = steps ?? []
  for (let k = 0; k < list.length; k++) {
    const step = list[k]!
    const next = list[k + 1]
    const after = list[k + 2]
    const matches =
      step.type === 'cells' &&
      next?.type === 'bin' &&
      after?.type === 'aggregate' &&
      fusesCellMatches(step, next, after)
        ? binnedCellMatches(current, step, next, after)
        : undefined
    const fused =
      !matches &&
      step.type === 'bin' &&
      next?.type === 'aggregate' &&
      fusesBinAggregate(step, next)
        ? binnedAggregate(current, step, next)
        : undefined
    if (matches) {
      current = matches
      k += 2
    } else if (fused) {
      current = fused
      k++
    } else {
      current = runStep(current, step, jexl)
    }
  }
  return current
}

/**
 * Each layer's steps over `steps` run once for all of them. A trailing
 * `cells` runs inside each layer whose own steps start with the bin and
 * aggregate it fuses with, so `runSteps` meets the three together, and once
 * for the other layers.
 */
function runLayers(
  staged: Staged,
  steps: readonly TransformStep[] | undefined,
  layers: readonly (readonly TransformStep[] | undefined)[],
  jexl: JexlInstance | undefined,
  keep: (s: Staged, ran: readonly TransformStep[] | undefined) => Staged = s =>
    s,
) {
  const list = steps ?? []
  const last = list.at(-1)
  const trailing =
    last?.type === 'cells' && layers.some(own => fusesAfterCells(last, own))
      ? last
      : undefined
  if (!trailing) {
    const shared = keep(runSteps(staged, list, jexl), list)
    return layers.map(own => keep(runSteps(shared, own, jexl), own))
  }
  const ahead = runSteps(staged, list.slice(0, -1), jexl)
  let shared: Staged | undefined
  return layers.map(own =>
    fusesAfterCells(trailing, own)
      ? keep(runSteps(ahead, [trailing, ...own!], jexl), [...list, ...own!])
      : keep(
          runSteps(
            (shared ??= keep(runStep(ahead, trailing, jexl), list)),
            own,
            jexl,
          ),
          own,
        ),
  )
}

function rowOf(value: unknown) {
  const row = Number(value)
  return row > 0 ? Math.floor(row) : 0
}

/**
 * A section's rows behind a step that made them from nothing, a coverage's
 * runs or an aggregate's groups, still answer the field their section was
 * split on, as a ggplot2 stat keeps its facet variable: one column of each
 * section's key, built the first time a channel reads it, and a parent that
 * carries the field itself is read instead.
 */
class SectionTable extends DerivedTable {
  private readonly field: string
  private readonly labels: readonly string[]
  private readonly bounds: Bounds

  constructor(
    parent: FeatureTable,
    field: string,
    labels: readonly string[],
    bounds: Bounds,
  ) {
    super(parent, undefined)
    this.field = field
    this.labels = labels
    this.bounds = bounds
  }

  protected own(field: string): Column | undefined {
    if (field !== this.field || this.parent.column(field).kind !== 'none') {
      return undefined
    }
    const { labels } = this
    const codes = new Uint32Array(this.length)
    for (let s = 0; s < labels.length; s++) {
      codes.fill(s, this.bounds[s], this.bounds[s + 1])
    }
    // the section of the rows with nothing in the field answers nothing
    return labels.includes('')
      ? { kind: 'value', read: i => labels[codes[i]!] || undefined }
      : { kind: 'category', codes, labels, at: undefined }
  }

  override json(i: number): SimpleFeatureSerialized {
    const out = super.json(i)
    const label = valueAt(this.column(this.field), i)
    return label === undefined || this.field in out
      ? out
      : { ...out, [this.field]: label }
  }
}

function makesRows(steps: readonly TransformStep[] | undefined) {
  return steps?.some(s => s.type === 'aggregate' || s.type === 'coverage')
}

// The staged rows still naming their section's value where a step made them
function keepingSection(
  staged: Staged,
  steps: readonly TransformStep[] | undefined,
  field: FieldRef,
  labels: readonly string[],
): Staged {
  return !isJexl(field) && makesRows(steps)
    ? {
        ...staged,
        table: new SectionTable(staged.table, field, labels, staged.bounds),
      }
    : staged
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

  const labels = ordered.map(k => keys[k]!)
  const layered = runLayers(
    { table: selectRows(table, order), bounds },
    sectionSteps,
    layers.map(({ transform }) => transform),
    jexl,
    (staged, steps) => keepingSection(staged, steps, field, labels),
  )
  const placed = layers.map(({ row }, l) => {
    const out = layered[l]!
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
      const as = step.as ?? DEFAULT_BIN_AS
      return step.fields ? [...as, BIN_OVERLAP_FIELD] : as
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
    const table = asTable(input)
    const layered = runLayers(
      { table, bounds: oneSection(table.length) },
      transform,
      layers.map(layer => layer.transform),
      jexl,
    )
    return {
      layers: layers.map((layer, l) => ({
        table: layered[l]!.table,
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
