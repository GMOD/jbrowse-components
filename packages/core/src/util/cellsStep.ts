// The `cells` step: each row's runs against the reference it was fanned out
// of, and the texts its walk reads, which the fused identity kernel in
// cellMatches.ts walks too. Imported by relative path only.
import {
  DerivedTable,
  numberReaderOf,
  readerOf,
  valueAt,
} from './featureTable.ts'
import { FannedTable, boundsThrough } from './stepTables.ts'

import type { Column, FeatureTable, TextColumn } from './featureTable.ts'
import type { CellsStep } from './markEncodingTypes.ts'
import type { SimpleFeatureSerialized } from './simpleFeature.ts'
import type { Staged } from './stepTables.ts'

export const DEFAULT_CELLS_FIELD = 'seq'

export const DASH = 45
export const SPACE = 32
const LOWER_BIT = 0x20

const CELL_STATES = ['match', 'mismatch', 'gap', 'insertion'] as const
export const MATCH = 0
export const MISMATCH = 1
const GAP = 2
const INSERTION = 3
export const NO_STATE = 255

export function isGapByte(b: number) {
  return b === DASH || b === SPACE
}

// The columns carrying the row's own sequence: a gap run reaching either end
// of the row measures where the block was cut, not the alignment, so it is no
// cell either.
export function firstDrawn(bytes: Uint8Array, at: number, len: number) {
  let first = 0
  while (first < len && isGapByte(bytes[at + first]!)) {
    first++
  }
  return first
}

export function lastDrawn(
  bytes: Uint8Array,
  at: number,
  len: number,
  first: number,
) {
  let last = len - 1
  while (last > first && isGapByte(bytes[at + last]!)) {
    last--
  }
  return last
}

// A reference base's cell: no state outside the drawn columns, else the row's
// gap, or its base matched or not regardless of case.
export function cellState(refByte: number, rowByte: number, drawn: boolean) {
  return !drawn
    ? NO_STATE
    : isGapByte(rowByte)
      ? GAP
      : (refByte | LOWER_BIT) === (rowByte | LOWER_BIT)
        ? MATCH
        : MISMATCH
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

// Below this length a character loop copies a string faster than
// `encodeInto`, as the MAF packer measured.
const ASCII_COPY_MAX_LENGTH = 64
const encoder = new TextEncoder()

// A column's text as bytes, one per character: an adapter's own, or the
// strings a feature holds copied into one buffer.
function textOf(column: Column, n: number): TextColumn {
  if (column.kind === 'text') {
    return column
  }
  const read = readerOf(column)
  const texts = new Array<string | undefined>(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    const v = read(i)
    if (typeof v === 'string') {
      texts[i] = v
      total += v.length
    }
  }
  const bytes = new Uint8Array(total)
  const offset = new Uint32Array(n)
  const length = new Uint32Array(n)
  let pos = 0
  for (let i = 0; i < n; i++) {
    const text = texts[i]
    if (text === undefined) {
      continue
    }
    offset[i] = pos
    if (text.length <= ASCII_COPY_MAX_LENGTH) {
      for (let c = 0; c < text.length; c++) {
        bytes[pos + c] = text.charCodeAt(c)
      }
      length[i] = text.length
    } else {
      length[i] = encoder.encodeInto(
        text,
        bytes.subarray(pos, pos + text.length),
      ).written
    }
    pos += text.length
  }
  return { kind: 'text', bytes, offset, length, at: undefined }
}

/**
 * The texts a `cells` walk reads, by the row of the table it walked: each
 * row's own, and the reference it is read against, which a row fanned out of
 * a container reads off the container.
 */
class WalkedTexts {
  readonly row: TextColumn
  readonly reference: TextColumn
  private readonly refRow: Uint32Array | undefined

  constructor(row: TextColumn, ref: TextColumn, refRow?: Uint32Array) {
    this.row = row
    this.reference = ref
    this.refRow = refRow
  }

  rowOf(r: number) {
    const { at } = this.row
    return at ? at[r]! : r
  }

  refOf(r: number) {
    const p = this.refRow ? this.refRow[r]! : r
    const { at } = this.reference
    return at ? at[p]! : p
  }
}

export function walkedTexts(table: FeatureTable, field: string) {
  const row = textOf(table.column(field), table.length)
  const container = containerOf(table)
  const made = container?.made
  if (container && !(made instanceof FannedTable && made.hasKept)) {
    const { table: base } = container
    return new WalkedTexts(
      row,
      textOf(base.column(field), base.length),
      container.row,
    )
  }
  // A container a flatten kept with nothing to fan out is the row itself, so
  // its reference is its own container's, as its `parent()` says.
  const byParent = (r: number) => table.row(r).parent?.()?.get(field)
  const readContainer = container
    ? readerOf(container.table.column(field))
    : undefined
  const read =
    readContainer && made instanceof FannedTable
      ? (r: number) => {
          const { toMade, row: refRow } = container!
          return made.isKept(toMade ? toMade[r]! : r)
            ? byParent(r)
            : readContainer(refRow ? refRow[r]! : r)
        }
      : byParent
  return new WalkedTexts(row, textOf({ kind: 'value', read }, table.length))
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
  private readonly texts: WalkedTexts
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
    texts: WalkedTexts,
  ) {
    super(parent, parentRow)
    this.start = lanes.start
    this.end = lanes.end
    this.state = lanes.state
    this.textAt = lanes.textAt
    this.texts = texts
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
                ? this.mismatched(i)
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

  private mismatched(i: number) {
    const { bytes, offset } = this.texts.row
    const k = this.texts.rowOf(this.parentOf(i))
    return String.fromCharCode(bytes[offset[k]! + this.textAt[i]!]!)
  }

  // The bases a row holds where the reference has none, from the column the
  // insertion starts at to the reference's next base.
  private inserted(i: number) {
    const { row, reference: ref } = this.texts
    const r = this.parentOf(i)
    const k = this.texts.rowOf(r)
    const f = this.texts.refOf(r)
    const rowAt = row.offset[k]!
    const refAt = ref.offset[f]!
    const end = Math.min(row.length[k]!, ref.length[f]!)
    let out = ''
    for (
      let col = this.textAt[i]!;
      col < end && ref.bytes[refAt + col] === DASH;
      col++
    ) {
      const b = row.bytes[rowAt + col]!
      if (!isGapByte(b)) {
        out += String.fromCharCode(b)
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
  start: Uint32Array
  end: Uint32Array
  state: Uint8Array
  textAt: Uint32Array
  parentRow: Uint32Array
  length = 0

  constructor(capacity: number) {
    this.start = new Uint32Array(capacity)
    this.end = new Uint32Array(capacity)
    this.state = new Uint8Array(capacity)
    this.textAt = new Uint32Array(capacity)
    this.parentRow = new Uint32Array(capacity)
  }

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

  // One row's runs against its reference: a run per column is the most it
  // can answer, so the lanes grow once and the walk writes through locals.
  walk(
    r: number,
    startPos: number,
    rowBytes: Uint8Array,
    rowAt: number,
    rowLen: number,
    refBytes: Uint8Array,
    refAt: number,
    refLen: number,
  ) {
    this.reserve(refLen + 1)
    const { start, end, state, textAt, parentRow } = this
    let n = this.length
    let pos = startPos
    const first = firstDrawn(rowBytes, rowAt, rowLen)
    const last = lastDrawn(rowBytes, rowAt, rowLen, first)
    let runStart = -1
    let runState = NO_STATE
    let runBase = -1
    let runCol = 0
    let insertAt = -1
    for (let col = 0; col < refLen; col++) {
      const refByte = refBytes[refAt + col]!
      const rowByte = col < rowLen ? rowBytes[rowAt + col]! : SPACE
      if (refByte === DASH) {
        if (insertAt < 0 && col < rowLen && !isGapByte(rowByte)) {
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
      const st = cellState(
        refByte,
        rowByte,
        col >= first && col <= last && col < rowLen,
      )
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
    this.length = n
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

export function cells({ table, bounds }: Staged, step: CellsStep): Staged {
  const { field = DEFAULT_CELLS_FIELD } = step
  const texts = walkedTexts(table, field)
  const readStart = numberReaderOf(table.column('start'))
  const { bytes: rowBytes, offset: rowOffset, length: rowLength } = texts.row
  const {
    bytes: refBytes,
    offset: refOffset,
    length: refLength,
  } = texts.reference

  // A run per reference base is the most a row can answer and far past what
  // one does, so the lanes start at an eighth of it.
  let bound = 0
  for (let r = 0; r < table.length; r++) {
    bound += refLength[texts.refOf(r)]! + 1
  }
  const lanes = new RunLanes(Math.max(1024, bound >>> 3))
  for (let r = 0; r < table.length; r++) {
    const f = texts.refOf(r)
    const refLen = refLength[f]!
    const pos = readStart(r)
    if (refLen > 0 && pos >= 0) {
      const k = texts.rowOf(r)
      lanes.walk(
        r,
        pos,
        rowBytes,
        rowOffset[k]!,
        rowLength[k]!,
        refBytes,
        refOffset[f]!,
        refLen,
      )
    }
  }
  const n = lanes.length
  const rows = lanes.parentRow.subarray(0, n)
  return {
    table: new CellTable(
      table,
      rows,
      {
        start: lanes.start.subarray(0, n),
        end: lanes.end.subarray(0, n),
        state: lanes.state.subarray(0, n),
        textAt: lanes.textAt.subarray(0, n),
      },
      texts,
    ),
    bounds: boundsThrough(bounds, rows),
  }
}
