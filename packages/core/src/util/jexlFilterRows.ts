import {
  callSubject,
  conditions,
  pathSubject,
  print,
  printCondition,
} from '@jbrowse/jexl'

import { JEXL_PREFIX, ensureJexlPrefix, isJexl } from './jexlStrings.ts'

import type { AstNode, Condition, Scalar, Subject } from '@jbrowse/jexl'

export type JexlFilterFieldType = 'number' | 'text' | 'flag'

export type JexlFilterField = {
  label: string
  /** unset for a field whose values may be numbers or text */
  type?: JexlFilterFieldType
  group?: string
  description?: string
  /** holds several values per feature, so a comparison asks whether any does */
  multi?: boolean
  values?: string[]
} & ({ path: string[] } | { call: string })

export interface FieldChoice {
  key: string
  label: string
  type?: JexlFilterFieldType
  subject: Subject
  group?: string
  description?: string
  multi?: boolean
  values?: string[]
}

export type RowOp =
  | '>'
  | '>='
  | '<'
  | '<='
  | '=='
  | '!='
  | 'in'
  | '~'
  | 'set'
  | '!set'

export const OPERATORS: Record<
  JexlFilterFieldType | 'any',
  { op: RowOp; label: string }[]
> = {
  number: [
    { op: '>', label: '>' },
    { op: '>=', label: '≥' },
    { op: '<', label: '<' },
    { op: '<=', label: '≤' },
    { op: '==', label: '=' },
    { op: '!=', label: '≠' },
  ],
  text: [
    { op: '==', label: 'is' },
    { op: '!=', label: 'is not' },
    { op: 'in', label: 'is one of' },
    { op: '~', label: 'matches' },
  ],
  flag: [
    { op: 'set', label: 'is set' },
    { op: '!set', label: 'is not set' },
  ],
  any: [
    { op: '==', label: 'is' },
    { op: '!=', label: 'is not' },
    { op: '>', label: '>' },
    { op: '>=', label: '≥' },
    { op: '<', label: '<' },
    { op: '<=', label: '≤' },
    { op: 'in', label: 'is one of' },
    { op: '~', label: 'matches' },
  ],
}

export interface ConditionRow {
  kind: 'condition'
  id: number
  line?: number
  field?: FieldChoice
  op: RowOp
  value: string | string[]
}

export interface TextRow {
  kind: 'text'
  id: number
  line?: number
  text: string
}

export type FilterRow = ConditionRow | TextRow

/**
 * Rows keep the index of the stored line they came from until one of that
 * line's rows changes, so an untouched line is written back byte-identical.
 */
export interface FilterRows {
  lines: readonly string[]
  rows: FilterRow[]
}

interface Parser {
  parse: (text: string) => AstNode | null
}

const ROW = 'feature'

function subjectKey(subject: Subject) {
  return JSON.stringify(
    subject.kind === 'path'
      ? ['path', ...subject.path]
      : ['call', subject.name, ...subject.args],
  )
}

export function resolveFields(fields: readonly JexlFilterField[]) {
  return fields.map(
    ({ label, type, group, description, multi, values, ...source }) => {
      const subject =
        'call' in source
          ? callSubject(ROW, source.call)
          : pathSubject(ROW, source.path)
      return {
        key: subjectKey(subject),
        label,
        type,
        group,
        description,
        multi,
        values,
        subject,
      } satisfies FieldChoice
    },
  )
}

// a feature carries these as refName, start and end
const BED_LOCUS_COLUMNS = new Set(['chrom', 'chromStart', 'chromEnd'])

/**
 * The columns an adapter's metadata describes as `{column: description}`, as
 * a BigBed's autoSql does, less those `fields` already lists. Any other
 * metadata describes none.
 */
export function describedColumns(
  metadata: unknown,
  fields: readonly JexlFilterField[],
): JexlFilterField[] {
  const entries =
    metadata && typeof metadata === 'object' ? Object.entries(metadata) : []
  const listed = new Set(fields.map(field => field.label))
  return entries.every(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )
    ? entries
        .filter(([name]) => !listed.has(name) && !BED_LOCUS_COLUMNS.has(name))
        .map(([name, description]) => ({
          label: name,
          path: [name],
          description: description || undefined,
        }))
    : []
}

/** A field typed into the picker rather than chosen, read as a dotted path. */
export function typedField(text: string): FieldChoice {
  const subject = pathSubject(ROW, text.split('.'))
  return { key: subjectKey(subject), label: text, subject }
}

export function stripJexlPrefix(line: string) {
  return isJexl(line) ? line.slice(JEXL_PREFIX.length) : line
}

/** A field of no known type writes a value that reads as a number as one. */
function scalar(type: JexlFilterFieldType | undefined, text: string) {
  const number = Number(text)
  return type === 'number' ||
    (!type && text.trim() !== '' && Number.isFinite(number))
    ? number
    : text
}

function subjectLabel(subject: Subject) {
  return subject.kind === 'path'
    ? subject.path
        .map((key, i) =>
          typeof key === 'number' ? `[${key}]` : i === 0 ? key : `.${key}`,
        )
        .join('')
    : print(subject.node)
}

function conditionRow(
  c: Condition,
  choices: readonly FieldChoice[],
  id: number,
  line: number,
): ConditionRow | undefined {
  const value = 'value' in c ? c.value : undefined
  const key = subjectKey(c.subject)
  const field = choices.find(f => f.key === key) ?? {
    key,
    label: subjectLabel(c.subject),
    type: value === undefined ? 'flag' : undefined,
    subject: c.subject,
  }
  const op = c.op as RowOp
  const values = value === undefined ? [] : [value].flat()
  const writesBack = (v: Scalar) =>
    op === '~' ? typeof v === 'string' : scalar(field.type, String(v)) === v
  return OPERATORS[field.type ?? 'any'].some(o => o.op === op) &&
    values.every(writesBack)
    ? {
        kind: 'condition',
        id,
        line,
        field,
        op,
        value: Array.isArray(value) ? value.map(String) : String(value ?? ''),
      }
    : undefined
}

function parseConditions(text: string, parser: Parser, calls: string[]) {
  try {
    return conditions(parser.parse(text), {
      row: ROW,
      accessors: { get: [] },
      calls,
    })
  } catch {
    return undefined
  }
}

export function readFilterRows(
  lines: readonly string[],
  parser: Parser,
  choices: readonly FieldChoice[],
): FilterRows {
  const calls = choices.flatMap(f =>
    f.subject.kind === 'call' ? [f.subject.name] : [],
  )
  const rows: FilterRow[] = []
  for (const [line, stored] of lines.entries()) {
    const text = stripJexlPrefix(stored)
    const id = rows.length
    const read = parseConditions(text, parser, calls)?.map((c, i) =>
      conditionRow(c, choices, id + i, line),
    )
    rows.push(
      ...(read?.every(row => row !== undefined)
        ? read
        : [{ kind: 'text' as const, id, line, text: text.trim() }]),
    )
  }
  return { lines, rows }
}

function nextId(rows: FilterRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.id + 1), 0)
}

function emptyRow(id: number): ConditionRow {
  return { kind: 'condition', id, op: '==', value: '' }
}

export function addRow(state: FilterRows): FilterRows {
  return { ...state, rows: [...state.rows, emptyRow(nextId(state.rows))] }
}

function detach(rows: FilterRow[], id: number) {
  const line = rows.find(row => row.id === id)?.line
  return line === undefined
    ? rows
    : rows.map(row => (row.line === line ? { ...row, line: undefined } : row))
}

export function replaceRow(state: FilterRows, row: FilterRow): FilterRows {
  return {
    ...state,
    rows: detach(state.rows, row.id).map(r =>
      r.id === row.id ? { ...row, line: undefined } : r,
    ),
  }
}

export function removeRow(state: FilterRows, id: number): FilterRows {
  return {
    ...state,
    rows: detach(state.rows, id).filter(row => row.id !== id),
  }
}

export function withField(row: ConditionRow, field: FieldChoice): ConditionRow {
  const sameType = row.field?.type === field.type
  const ops = OPERATORS[field.type ?? 'any']
  return {
    ...row,
    field,
    op: sameType ? row.op : ops[0]!.op,
    value: sameType ? row.value : '',
  }
}

export function withOp(row: ConditionRow, op: RowOp): ConditionRow {
  const { value } = row
  return {
    ...row,
    op,
    value:
      op === 'in'
        ? Array.isArray(value)
          ? value
          : value
            ? [value]
            : []
        : Array.isArray(value)
          ? (value[0] ?? '')
          : value,
  }
}

function writeCondition({ field, op, value }: ConditionRow) {
  if (!field) {
    return undefined
  }
  const { subject, type } = field
  const usable = (v: string) =>
    v.trim() !== '' && (type !== 'number' || Number.isFinite(Number(v)))
  if (op === 'set' || op === '!set') {
    return printCondition({ subject, op })
  }
  if (op === 'in') {
    const list = [value].flat().filter(usable)
    return list.length > 0
      ? printCondition({
          subject,
          op,
          value: list.map(v => scalar(type, v)),
        })
      : undefined
  }
  const text = [value].flat()[0] ?? ''
  return !usable(text)
    ? undefined
    : op === '~'
      ? printCondition({ subject, op, value: text })
      : printCondition({ subject, op, value: scalar(type, text) })
}

function writeRow(row: FilterRow) {
  const text =
    row.kind === 'text' ? row.text.trim() || undefined : writeCondition(row)
  return text === undefined ? undefined : ensureJexlPrefix(text)
}

/**
 * The stored filters: an untouched line as it was, and every row of an edited
 * line as a line of its own, which is equivalent because lines AND together.
 * Rows left incomplete are dropped.
 */
export function writeFilterRows({ lines, rows }: FilterRows) {
  const out: string[] = []
  let previous: number | undefined
  for (const row of rows) {
    if (row.line === undefined) {
      const text = writeRow(row)
      if (text !== undefined) {
        out.push(text)
      }
    } else if (row.line !== previous) {
      out.push(lines[row.line]!)
    }
    previous = row.line
  }
  return out
}
